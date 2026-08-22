import type { FoodItem } from '../../data/models/food.ts'
import type { Recipe } from './models/recipe.ts'
import type { NutrientAmount, NutrientValues } from './models/nutritionValues.ts'

/**
 * Abweichung vom Instruktions-Pseudocode: `calculateRecipeNutrition`/
 * `calculatePerServing` nehmen hier zusätzlich eine `foodsById`-Lookup-Map
 * entgegen, statt die Zutaten selbst über `foodDatabaseService` nachzuladen.
 * Grund: `getFoodById` ist async (fetch-basiert) — eine reine, synchrone
 * Funktion lässt sich ohne Mocking/Netzwerk in `node:test` unit-testen (siehe
 * `nutritionCalculator.test.ts`) und ist einfacher von Hand nachzurechnen.
 * Aufrufer laden die Lebensmitteldatenbank einmalig (`getAllFoods()`) und
 * bauen daraus die Map, z.B. in `recipeDetailView.ts`.
 *
 * Kompatibilität mit `NutrientRequirement` (Instruktion 2): Nährstoff-IDs
 * ('energy', 'protein', 'fat', 'carbohydrates', 'fiber') sind identisch.
 * Einheiten stimmen für 'energy' (kcal), 'protein' (g) und 'fiber' (g, für
 * die Altersgruppen ab 19 Jahren) direkt überein. 'fat' und 'carbohydrates'
 * werden hier — wie in der Lebensmitteldatenbank — in Gramm berechnet,
 * während die DACH-Referenzwerte dafür bewusst in %-der-Energie angegeben
 * sind (da der Grammbedarf vom individuellen Energiebedarf abhängt, siehe
 * `referenceValues.ts`). Ein direkter Vergleich dieser beiden Nährstoffe
 * braucht deshalb eine Umrechnung zum Zeitpunkt des Vergleichs (geplant für
 * die nächste Instruktion), nicht schon hier.
 */
const NUTRIENT_DEFINITIONS: {
  nutrientId: string
  unit: string
  getPer100g: (food: FoodItem) => number | null
}[] = [
  { nutrientId: 'energy', unit: 'kcal', getPer100g: (food) => food.energyKcal },
  { nutrientId: 'protein', unit: 'g', getPer100g: (food) => food.protein },
  { nutrientId: 'fat', unit: 'g', getPer100g: (food) => food.fat },
  { nutrientId: 'carbohydrates', unit: 'g', getPer100g: (food) => food.carbohydrates },
  { nutrientId: 'fiber', unit: 'g', getPer100g: (food) => food.fiber },
]

export function calculateRecipeNutrition(
  recipe: Recipe,
  foodsById: Map<string, FoodItem>,
): NutrientValues {
  return NUTRIENT_DEFINITIONS.map(({ nutrientId, unit, getPer100g }): NutrientAmount => {
    let value = 0
    let incomplete = false

    for (const ingredient of recipe.ingredients) {
      const food = foodsById.get(ingredient.foodId)
      if (!food) {
        incomplete = true
        continue
      }
      const per100g = getPer100g(food)
      if (per100g === null) {
        incomplete = true
        continue
      }
      value += (per100g / 100) * ingredient.amountGrams
    }

    return { nutrientId, unit, value, incomplete }
  })
}

export function calculatePerServing(
  recipe: Recipe,
  foodsById: Map<string, FoodItem>,
): NutrientValues {
  const total = calculateRecipeNutrition(recipe, foodsById)
  return total.map((amount) => ({
    ...amount,
    value: amount.value / recipe.servings,
  }))
}
