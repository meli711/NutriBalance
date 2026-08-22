import type { RecipeIngredient } from '../../recipes/models/recipe.ts'

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
  ingredients: RecipeIngredient[]
}
