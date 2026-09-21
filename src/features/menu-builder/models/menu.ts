import type { RecipeIngredient } from '../../recipes/models/recipe.ts'
import type { MealCategory } from '../../../utils/mealCategoryIcon.ts'

/**
 * Bewusst strukturell identisch zu `Recipe` (nur ohne `servings`/
 * `instructions`, da ein Menü als Ganzes betrachtet wird, keine
 * Portionenlogik braucht) — dadurch funktioniert `nutritionCalculator`
 * unverändert für beide.
 */
export interface Menu {
  id: string
  name: string
  description: string
  /** ISO-Datum (`new Date().toISOString()`). */
  createdAt: string
  /**
   * Mahlzeiten-Kategorie fürs Icon in der Menü-Liste (Instruktion 21) —
   * dieselben Kategorien/Icons wie bei `Recipe.category` (Instruktion 20).
   * Optional: fehlt/unbekannt → kein Icon.
   */
  category?: MealCategory
  ingredients: RecipeIngredient[]
}
