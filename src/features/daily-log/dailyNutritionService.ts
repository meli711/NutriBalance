import { getFoodById } from '../../data/foodDatabaseService.ts'
import { getLogEntriesForDate, getMenuById } from '../../data/indexedDbService.ts'
import { getRecipeById } from '../recipes/recipeService.ts'
import { calculateNutrition, calculateRecipeNutrition } from '../recipes/nutritionCalculator.ts'
import type { FoodItem } from '../../data/models/food.ts'
import type { Recipe, RecipeIngredient } from '../recipes/models/recipe.ts'
import type { Menu } from '../menu-builder/models/menu.ts'
import type { NutrientAmount, NutrientValues } from '../recipes/models/nutritionValues.ts'
import type { LogEntry } from './models/logEntry.ts'

/**
 * Bereits geladene Daten, die zur Berechnung der Tagesaufnahme gebraucht
 * werden. Getrennt von `calculateDailyNutrition`, damit die eigentliche
 * Rechenlogik (`sumDailyNutrition`) rein/synchron bleibt und ohne
 * Fetch/IndexedDB in `node:test` unit-testbar ist — dasselbe Muster wie
 * bei `nutritionCalculator.ts` (Instruktion 4/6).
 */
export interface DailyLogContext {
  foodsById: Map<string, FoodItem>
  recipesById: Map<string, Recipe>
  menusById: Map<string, Menu>
}

function sumNutrientValues(all: NutrientValues[]): NutrientValues {
  const byId = new Map<string, NutrientAmount>()
  for (const values of all) {
    for (const amount of values) {
      const existing = byId.get(amount.nutrientId)
      if (existing) {
        existing.value += amount.value
        existing.incomplete = existing.incomplete || amount.incomplete
      } else {
        byId.set(amount.nutrientId, { ...amount })
      }
    }
  }
  return [...byId.values()]
}

/** Multipliziert alle Nährwerte mit `factor`, `incomplete`-Flags bleiben unverändert (Instruktion 15). */
function applyFactor(values: NutrientValues, factor: number): NutrientValues {
  if (factor === 1) return values
  return values.map((amount) => ({ ...amount, value: amount.value * factor }))
}

/**
 * Berechnet die Nährwerte eines einzelnen Log-Eintrags — für **ein**
 * Vorkommen (vor Anwendung von `factor`, siehe unten). `null` bedeutet: die
 * referenzierte Zutat/das Rezept/Menü existiert nicht (mehr) — der Eintrag
 * wird dann übersprungen statt abzustürzen (Instruktion 9, Edge Cases).
 */
function calculateSingleOccurrence(
  entry: LogEntry,
  context: DailyLogContext,
): NutrientValues | null {
  switch (entry.type) {
    case 'food': {
      const food = context.foodsById.get(entry.foodId)
      if (!food) return null
      const ingredients: RecipeIngredient[] = [
        { foodId: entry.foodId, amountGrams: entry.amountGrams },
      ]
      return calculateNutrition(ingredients, context.foodsById)
    }
    case 'recipe': {
      const recipe = context.recipesById.get(entry.recipeId)
      if (!recipe) return null
      return calculateRecipeNutrition(recipe, context.foodsById)
    }
    case 'menu': {
      const menu = context.menusById.get(entry.menuId)
      if (!menu) return null
      return calculateNutrition(menu.ingredients, context.foodsById)
    }
  }
}

/**
 * Berechnet die Nährwerte eines einzelnen Log-Eintrags inkl. `factor` — "wie
 * oft dieser Eintrag an diesem Tag vorkommt" (Instruktion 15), unabhängig
 * von `amountGrams` ("wie viel pro Vorkommen"; ein Rezept entspricht seit
 * Instruktion 19 immer genau einer Portion, ohne eigene Mengenangabe).
 */
function calculateEntryNutrition(entry: LogEntry, context: DailyLogContext): NutrientValues | null {
  const single = calculateSingleOccurrence(entry, context)
  if (!single) return null
  return applyFactor(single, entry.factor)
}

/**
 * Reine Kernfunktion: summiert die Tagesaufnahme aus bereits geladenen
 * Log-Einträgen + Referenzdaten. Exportiert für Unit-Tests (siehe
 * `dailyNutritionService.test.ts`) — `calculateDailyNutrition` unten ist nur
 * ein dünner I/O-Wrapper darum.
 */
export function sumDailyNutrition(entries: LogEntry[], context: DailyLogContext): NutrientValues {
  const perEntry: NutrientValues[] = []
  for (const entry of entries) {
    const values = calculateEntryNutrition(entry, context)
    if (values) perEntry.push(values)
  }
  return sumNutrientValues(perEntry)
}

/**
 * Lädt alle Referenzdaten (Zutaten/Rezepte/Menüs), die zur Berechnung der
 * übergebenen Log-Einträge gebraucht werden. Exportiert, damit die
 * Wochen-/Monatsübersicht (Instruktion 11) den Kontext **einmal** für alle
 * Einträge eines Zeitraums bauen kann, statt pro Tag neu.
 */
export async function buildDailyLogContext(entries: LogEntry[]): Promise<DailyLogContext> {
  const recipeIds = [...new Set(entries.filter((e) => e.type === 'recipe').map((e) => e.recipeId))]
  const menuIds = [...new Set(entries.filter((e) => e.type === 'menu').map((e) => e.menuId))]

  const [recipeResults, menuResults] = await Promise.all([
    Promise.all(recipeIds.map((id) => getRecipeById(id))),
    Promise.all(menuIds.map((id) => getMenuById(id))),
  ])

  const recipesById = new Map<string, Recipe>()
  recipeResults.forEach((recipe, index) => {
    if (recipe) recipesById.set(recipeIds[index]!, recipe)
  })

  const menusById = new Map<string, Menu>()
  menuResults.forEach((menu, index) => {
    if (menu) menusById.set(menuIds[index]!, menu)
  })

  // Für die Berechnung werden alle Zutaten gebraucht: direkt geloggte
  // Einzel-Zutaten + alle Zutaten der referenzierten Rezepte/Menüs.
  const foodIds = new Set<string>()
  for (const entry of entries) {
    if (entry.type === 'food') foodIds.add(entry.foodId)
  }
  for (const recipe of recipesById.values()) {
    for (const ingredient of recipe.ingredients) foodIds.add(ingredient.foodId)
  }
  for (const menu of menusById.values()) {
    for (const ingredient of menu.ingredients) foodIds.add(ingredient.foodId)
  }

  const foodIdList = [...foodIds]
  const foodResults = await Promise.all(foodIdList.map((id) => getFoodById(id)))
  const foodsById = new Map<string, FoodItem>()
  foodResults.forEach((food, index) => {
    if (food) foodsById.set(foodIdList[index]!, food)
  })

  return { foodsById, recipesById, menusById }
}

/** Lädt die Log-Einträge eines Tages + alle Referenzdaten und summiert sie. */
export async function calculateDailyNutrition(date: string): Promise<NutrientValues> {
  const entries = await getLogEntriesForDate(date)
  if (entries.length === 0) return []

  const context = await buildDailyLogContext(entries)
  return sumDailyNutrition(entries, context)
}
