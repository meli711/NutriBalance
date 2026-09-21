import type { MealCategory } from '../../../utils/mealCategoryIcon.ts'

export interface RecipeIngredient {
  /** Referenziert FoodItem.id aus food-database.json (siehe Instruktion 2). */
  foodId: string
  amountGrams: number
}

export interface Recipe {
  id: string
  name: string
  /**
   * Mahlzeiten-Kategorie fürs Icon in der Rezeptliste (Instruktion 20).
   * Bewusst das lesbare deutsche Label direkt (siehe `MealCategory`), nicht
   * ein technischer Code — liest sich beim manuellen Bearbeiten von
   * `recipes.json` zugleich wie ein Kommentar. Optional: fehlt/unbekannt →
   * kein Icon.
   */
  category?: MealCategory
  /**
   * Entspricht immer genau einer Portion (Instruktion 19 — bis dahin gab es
   * hier ein zusätzliches `servings`-Feld für Batch-Zubereitungen mit
   * Divisor). Wer eine grössere Zubereitung abbilden will, trägt die volle
   * Zutatenmenge ein und loggt sie ggf. mit `factor` mehrfach (analog zu
   * Menüs, siehe `LogEntryBase.factor`).
   */
  ingredients: RecipeIngredient[]
  /** Optional, kurze Zubereitungsschritte. */
  instructions?: string[]
}
