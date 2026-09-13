import type { FoodItem, FoodMinerals, FoodVitamins } from './models/food.ts'

/**
 * Eigene Zutaten, die die Nutzerin/der Nutzer direkt in der App erfasst
 * (Instruktion 13) — im Unterschied zu `quellen/eigene-produkte.json`
 * (Instruktion 12) leben diese Einträge **nur** im `localStorage` dieses
 * Geräts, nicht im Repo/in der generierten `food-database.json`. Deshalb ein
 * eigener ID-Präfix (`custom-local-`), damit sich beide Arten "eigener"
 * Einträge nicht versehentlich überschneiden.
 */
const STORAGE_KEY = 'nutribalance:customFoods'
export const CUSTOM_FOOD_ID_PREFIX = 'custom-local-'

export function isOwnCustomFoodId(id: string): boolean {
  return id.startsWith(CUSTOM_FOOD_ID_PREFIX)
}

function isValidNutrientValue(value: unknown): value is { value: number | null; unit: string } {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (v.value === null || typeof v.value === 'number') && typeof v.unit === 'string'
}

/**
 * Grobe Struktur-Prüfung, analog zu `assertFoodItem` in
 * `scripts/convert-food-db.ts` — aber als Type-Guard statt als werfende
 * Funktion, da hier (anders als beim Build-Skript) einzelne kaputte Einträge
 * einfach übersprungen statt der ganze Import abgebrochen werden soll (siehe
 * `parseStoredCustomFoods`).
 */
export function isValidCustomFoodItem(value: unknown): value is FoodItem {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>

  if (typeof v.id !== 'string' || v.id.trim() === '') return false
  const name = v.name as { de?: unknown } | undefined
  if (!name || typeof name.de !== 'string' || name.de.trim() === '') return false
  if (typeof v.category !== 'string') return false
  if (!v.vitamins || typeof v.vitamins !== 'object') return false
  if (!v.minerals || typeof v.minerals !== 'object') return false

  const numericOrNull = (field: unknown) => field === null || typeof field === 'number'
  if (
    !numericOrNull(v.energyKcal) ||
    !numericOrNull(v.protein) ||
    !numericOrNull(v.fat) ||
    !numericOrNull(v.saturatedFat) ||
    !numericOrNull(v.carbohydrates) ||
    !numericOrNull(v.sugar) ||
    !numericOrNull(v.fiber) ||
    !numericOrNull(v.water) ||
    !numericOrNull(v.alcohol)
  ) {
    return false
  }

  return (
    Object.values(v.vitamins as Record<string, unknown>).every(isValidNutrientValue) &&
    Object.values(v.minerals as Record<string, unknown>).every(isValidNutrientValue)
  )
}

/**
 * Reine Parsing-Logik, getrennt von `localStorage.getItem` (analog zu
 * `parseStoredProfile` in `localStorageService.ts`), damit sie ohne echtes
 * `localStorage` testbar ist. Anders als dort wird bei kaputten *einzelnen*
 * Einträgen nicht die ganze Liste verworfen, sondern nur der jeweilige
 * Eintrag übersprungen — ein Tippfehler/eine beschädigte Zeile soll nicht
 * gleich alle anderen eigenen Zutaten verschwinden lassen.
 */
export function parseStoredCustomFoods(raw: string | null): FoodItem[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidCustomFoodItem)
  } catch {
    return []
  }
}

export function getCustomFoods(): FoodItem[] {
  return parseStoredCustomFoods(localStorage.getItem(STORAGE_KEY))
}

export function saveCustomFoods(foods: FoodItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(foods))
}

/**
 * Eigene Zutaten decken bewusst nur Energie + Makronährstoffe ab (siehe
 * Formular) — für alle Vitamine/Mineralstoffe fehlt schlicht die
 * Datengrundlage bei Hand-Erfassung. `null` statt `0`, damit die
 * bestehende "unvollständig"-Kennzeichnung (siehe `nutritionCalculator.ts`)
 * greift statt einen tatsächlichen Nullgehalt vorzutäuschen.
 */
function emptyVitamins(): FoodVitamins {
  const unit = (u: string) => ({ value: null, unit: u })
  return {
    aRetinolEquivalent: unit('µg'),
    aRetinolActivityEquivalent: unit('µg'),
    retinol: unit('µg'),
    betaCaroteneActivity: unit('µg'),
    betaCarotene: unit('µg'),
    b1Thiamin: unit('mg'),
    b2Riboflavin: unit('mg'),
    b6Pyridoxin: unit('mg'),
    b12Cobalamin: unit('µg'),
    niacinEquivalent: unit('mg'),
    niacin: unit('mg'),
    folate: unit('µg'),
    pantothenicAcid: unit('mg'),
    c: unit('mg'),
    d: unit('µg'),
    e: unit('mg'),
  }
}

function emptyMinerals(): FoodMinerals {
  const unit = (u: string) => ({ value: null, unit: u })
  return {
    potassium: unit('mg'),
    sodium: unit('mg'),
    chloride: unit('mg'),
    calcium: unit('mg'),
    magnesium: unit('mg'),
    phosphorus: unit('mg'),
    iron: unit('mg'),
    iodine: unit('µg'),
    zinc: unit('mg'),
    selenium: unit('µg'),
    salt: unit('g'),
  }
}

/** Eingabefelder des Formulars — bewusst eine Teilmenge von `FoodItem` (siehe `emptyVitamins`/`emptyMinerals`). */
export interface CustomFoodInput {
  name: string
  category: string
  energyKcal: number | null
  protein: number | null
  fat: number | null
  saturatedFat: number | null
  carbohydrates: number | null
  sugar: number | null
  fiber: number | null
}

const DEFAULT_CATEGORY = 'Eigene Zutaten'

/** Neue eigene Zutat anlegen (noch nicht gespeichert, siehe `upsertCustomFood`). */
export function createCustomFood(input: CustomFoodInput): FoodItem {
  return {
    id: `${CUSTOM_FOOD_ID_PREFIX}${crypto.randomUUID()}`,
    name: { de: input.name.trim() },
    category: input.category.trim() || DEFAULT_CATEGORY,
    energyKcal: input.energyKcal,
    protein: input.protein,
    fat: input.fat,
    saturatedFat: input.saturatedFat,
    carbohydrates: input.carbohydrates,
    sugar: input.sugar,
    fiber: input.fiber,
    water: null,
    alcohol: null,
    vitamins: emptyVitamins(),
    minerals: emptyMinerals(),
  }
}

/** Bestehende eigene Zutat mit neuen Werten überschreiben, Identität (`id`) bleibt erhalten. */
export function applyCustomFoodInput(existing: FoodItem, input: CustomFoodInput): FoodItem {
  return {
    ...existing,
    name: { de: input.name.trim() },
    category: input.category.trim() || DEFAULT_CATEGORY,
    energyKcal: input.energyKcal,
    protein: input.protein,
    fat: input.fat,
    saturatedFat: input.saturatedFat,
    carbohydrates: input.carbohydrates,
    sugar: input.sugar,
    fiber: input.fiber,
  }
}

/** Fügt eine neue eigene Zutat an oder ersetzt eine bestehende (gleiche `id`) an Ort und Stelle. */
export function upsertCustomFood(food: FoodItem): void {
  const foods = getCustomFoods()
  const index = foods.findIndex((f) => f.id === food.id)
  if (index === -1) foods.push(food)
  else foods[index] = food
  saveCustomFoods(foods)
}

export function deleteCustomFood(id: string): void {
  saveCustomFoods(getCustomFoods().filter((food) => food.id !== id))
}
