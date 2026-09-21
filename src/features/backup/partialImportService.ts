import { isOwnCustomFoodId } from '../../data/customFoodService.ts'
import type { FoodItem } from '../../data/models/food.ts'
import type { Menu } from '../menu-builder/models/menu.ts'

/**
 * Ergebnis eines selektiven Imports (Instruktion 18) — im Unterschied zum
 * vollen Backup-Import (`backupService.ts`, Instruktion 10) wird hier
 * **zusammengeführt** statt ersetzt: bestehende Einträge bleiben immer
 * erhalten, siehe `mergeImportedItems`.
 */
export interface MergeResult<T extends { id: string }> {
  /** Bestehende Einträge unverändert + neu übernommene (ggf. mit neuer ID) angehängt. */
  items: T[]
  /** Alte → neue ID, nur für Einträge mit echter ID-Kollision + abweichendem Inhalt. */
  idRemap: Map<string, string>
  /** Anzahl tatsächlich neu übernommener Einträge (inkl. umbenannter Kopien). */
  importedCount: number
  /** Anzahl übersprungener Einträge, weil unter derselben ID bereits inhaltlich identisch vorhanden. */
  skippedIdenticalCount: number
}

/** Struktureller Vergleich (nicht nur Referenzgleichheit) — für `FoodItem`/`Menu` ausreichend, da beide reine JSON-Daten sind. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null) return false
  if (typeof a !== 'object') return false

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }

  const aKeys = Object.keys(a as Record<string, unknown>)
  const bKeys = Object.keys(b as Record<string, unknown>)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}

/**
 * Führt `incoming` additiv in `existing` zusammen — nie wird ein
 * bestehender Eintrag überschrieben (siehe Instruktion 18, Abschnitt
 * "Warum IDs kollidieren können"):
 * - keine ID-Kollision → unverändert übernehmen
 * - Kollision mit identischem Inhalt → überspringen (macht wiederholten
 *   Import derselben Datei ungefährlich)
 * - Kollision mit abweichendem Inhalt → Kopie unter neuer, per
 *   `generateId()` erzeugter ID anlegen, `idRemap` vermerkt die
 *   Umbenennung (für Fremdschlüssel-Anpassungen, siehe
 *   `remapMenuIngredients`)
 *
 * Die Prüfung läuft gegen den bereits aufgebauten Zwischenstand, nicht nur
 * gegen `existing` — zwei Einträge aus `incoming`, die zufällig dieselbe ID
 * teilen, kollidieren dadurch ebenfalls korrekt untereinander.
 *
 * `items.slice(existing.length)` liefert exakt die neu hinzugekommenen
 * Einträge, da `existing` unverändert an den Anfang kopiert wird und nur
 * neue/umbenannte Kopien angehängt werden.
 */
export function mergeImportedItems<T extends { id: string }>(
  existing: T[],
  incoming: T[],
  generateId: () => string,
): MergeResult<T> {
  const items = [...existing]
  const byId = new Map(items.map((item, index) => [item.id, index]))
  const idRemap = new Map<string, string>()
  let importedCount = 0
  let skippedIdenticalCount = 0

  for (const item of incoming) {
    const existingIndex = byId.get(item.id)

    if (existingIndex === undefined) {
      byId.set(item.id, items.length)
      items.push(item)
      importedCount++
      continue
    }

    if (deepEqual(items[existingIndex], item)) {
      skippedIdenticalCount++
      continue
    }

    const newId = generateId()
    idRemap.set(item.id, newId)
    const renamed = { ...item, id: newId }
    byId.set(newId, items.length)
    items.push(renamed)
    importedCount++
  }

  return { items, idRemap, importedCount, skippedIdenticalCount }
}

/** IDs eigener Zutaten (`isOwnCustomFoodId`), die `menu` referenziert, aber die in `localCustomFoods` fehlen. Generische BLV-IDs werden ignoriert. */
export function findMissingCustomFoodIds(menu: Menu, localCustomFoods: FoodItem[]): string[] {
  const localIds = new Set(localCustomFoods.map((food) => food.id))
  const missing = new Set<string>()
  for (const ingredient of menu.ingredients) {
    if (isOwnCustomFoodId(ingredient.foodId) && !localIds.has(ingredient.foodId)) {
      missing.add(ingredient.foodId)
    }
  }
  return [...missing]
}

export interface ResolvedMenuFoods {
  /** In der Backup-Datei gefundene, lokal fehlende eigene Zutaten (dedupliziert über mehrere Menüs). */
  foods: FoodItem[]
  /** Referenzierte eigene-Zutat-IDs, die weder lokal noch in der Backup-Datei existieren. */
  unresolvedIds: string[]
}

/**
 * Sammelt für `menus` alle lokal fehlenden eigenen Zutaten und versucht,
 * sie aus `backupCustomFoods` (derselben Backup-Datei) aufzulösen — für den
 * automatischen Mitimport unbekannter Zutaten beim Menü-Import (Instruktion
 * 18). Was auch dort fehlt, landet in `unresolvedIds` (bleibt beim
 * bestehenden "Unbekannte Zutat"-Verhalten, Instruktion 9).
 */
export function resolveReferencedCustomFoods(
  menus: Menu[],
  backupCustomFoods: FoodItem[],
  localCustomFoods: FoodItem[],
): ResolvedMenuFoods {
  const backupById = new Map(backupCustomFoods.map((food) => [food.id, food]))
  const missingIds = new Set(
    menus.flatMap((menu) => findMissingCustomFoodIds(menu, localCustomFoods)),
  )

  const foods: FoodItem[] = []
  const unresolvedIds: string[] = []
  for (const id of missingIds) {
    const food = backupById.get(id)
    if (food) foods.push(food)
    else unresolvedIds.push(id)
  }

  return { foods, unresolvedIds }
}

/** Neues `Menu`-Objekt mit gemäss `idRemap` angepassten `ingredients[].foodId` — nur betroffene Zutaten ändern sich, `menu` bleibt unverändert. */
export function remapMenuIngredients(menu: Menu, idRemap: Map<string, string>): Menu {
  if (idRemap.size === 0) return menu
  return {
    ...menu,
    ingredients: menu.ingredients.map((ingredient) => {
      const newId = idRemap.get(ingredient.foodId)
      return newId === undefined ? ingredient : { ...ingredient, foodId: newId }
    }),
  }
}
