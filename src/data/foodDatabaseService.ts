import type { FoodItem } from './models/food.ts'
import { getCustomFoods } from './customFoodService.ts'

// `import.meta.env.BASE_URL` statt eines fest verdrahteten "/", damit ein
// Deployment in einem Unterordner (z.B. via `vite build --base=/pfad/`)
// funktioniert, nicht nur im Domain-Root. `?? '/'` als Fallback, da
// `import.meta.env` ausserhalb von Vite (z.B. beim reinen `node --test`,
// wenn ein Test dieses Modul transitiv importiert, ohne fetch tatsächlich
// aufzurufen) nicht existiert.
const DATABASE_URL = `${import.meta.env?.BASE_URL ?? '/'}data/food-database.json`

let cache: FoodItem[] | null = null
let loadPromise: Promise<FoodItem[]> | null = null

async function loadDatabase(): Promise<FoodItem[]> {
  if (cache) return cache
  if (!loadPromise) {
    loadPromise = fetch(DATABASE_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Nährwertdatenbank konnte nicht geladen werden: ${res.status}`)
        }
        return res.json() as Promise<FoodItem[]>
      })
      .then((foods) => {
        cache = foods
        return foods
      })
  }
  return loadPromise
}

/**
 * Mischt eigene Zutaten (Instruktion 13) in die generische Datenbank ein —
 * analog zu `mergeCustomProducts` in `scripts/convert-food-db.ts`, nur zur
 * Laufzeit statt beim Build: gleiche `id` ersetzt den generischen Eintrag an
 * Ort und Stelle, neue `id` wird angehängt. Reine Funktion (kein
 * `localStorage`-Zugriff), damit sie ohne Browser-Umgebung testbar ist —
 * siehe `getAllFoods` für die Verdrahtung mit `getCustomFoods()`.
 */
export function mergeFoods(generic: FoodItem[], custom: FoodItem[]): FoodItem[] {
  if (custom.length === 0) return generic

  const merged = [...generic]
  const indexById = new Map(merged.map((food, index) => [food.id, index]))

  for (const customFood of custom) {
    const existingIndex = indexById.get(customFood.id)
    if (existingIndex !== undefined) merged[existingIndex] = customFood
    else {
      indexById.set(customFood.id, merged.length)
      merged.push(customFood)
    }
  }
  return merged
}

/**
 * `getCustomFoods()` liest bei jedem Aufruf frisch aus dem `localStorage`
 * (im Gegensatz zur gecachten generischen Liste), damit Änderungen ohne
 * Reload sofort in Suche/Log/Menü-Builder sichtbar sind.
 */
export async function getAllFoods(): Promise<FoodItem[]> {
  return mergeFoods(await loadDatabase(), getCustomFoods())
}

export async function getFoodById(id: string): Promise<FoodItem | undefined> {
  const foods = await getAllFoods()
  return foods.find((food) => food.id === id)
}

/**
 * Je kleiner die Zahl, desto besser der Treffer. -1 bedeutet: kein Treffer.
 * Ein exakter Treffer auf Name oder Synonym (z.B. Synonym "Ei" bei der Suche
 * nach "Ei") wird höher gewichtet als ein reiner Teilstring-Treffer (z.B.
 * "Reis", "Weizen"), damit häufig gebrauchte Zutaten wie "Ei, ganzes" bei
 * der Suche nach "Ei" als erster Treffer erscheinen.
 */
function matchRank(food: FoodItem, normalizedQuery: string): number {
  const nameLower = food.name.de.toLowerCase()
  const synonymsLower = food.synonyms?.map((synonym) => synonym.toLowerCase()) ?? []

  if (nameLower === normalizedQuery) return 0
  if (synonymsLower.includes(normalizedQuery)) return 1
  if (nameLower.startsWith(normalizedQuery)) return 2
  if (synonymsLower.some((synonym) => synonym.startsWith(normalizedQuery))) return 3
  if (nameLower.includes(normalizedQuery)) return 4
  if (synonymsLower.some((synonym) => synonym.includes(normalizedQuery))) return 5
  return -1
}

export function rankFoodsByQuery(foods: FoodItem[], query: string): FoodItem[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  return foods
    .map((food) => ({ food, rank: matchRank(food, normalizedQuery) }))
    .filter((entry) => entry.rank !== -1)
    .sort((a, b) => a.rank - b.rank || a.food.name.de.localeCompare(b.food.name.de, 'de'))
    .map((entry) => entry.food)
}

export async function searchFoodsByName(query: string): Promise<FoodItem[]> {
  const foods = await getAllFoods()
  return rankFoodsByQuery(foods, query)
}
