import type { FoodItem } from '../../data/models/food.ts'
import type { Recipe, RecipeIngredient } from './models/recipe.ts'
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
 * ('energy', 'protein', 'fat', 'carbohydrates', 'fiber', 'calcium', 'iron',
 * 'vitaminC', 'vitaminB12', 'folate') sind identisch. Einheiten stimmen für
 * 'energy' (kcal), 'protein' (g), 'fiber' (g, für die Altersgruppen ab 19
 * Jahren), 'calcium' (mg), 'iron' (mg), 'vitaminC' (mg), 'vitaminB12' (µg)
 * und 'folate' (µg) direkt überein. µ ist dabei überall U+00B5 (MICRO SIGN),
 * wie in `food.ts`/`customFoodService.ts`, sonst schlägt der
 * Einheitenvergleich in `dailyRequirementPercentage.ts` still fehl. 'fat' und
 * 'carbohydrates' werden hier — wie in der Lebensmitteldatenbank — in Gramm
 * berechnet, während die DACH-Referenzwerte dafür bewusst in %-der-Energie
 * angegeben sind (da der Grammbedarf vom individuellen Energiebedarf
 * abhängt, siehe `referenceValues.ts`). Die Umrechnung für den Vergleich
 * "% Tagesbedarf" übernimmt `dailyRequirementPercentage.ts`, nicht dieses
 * Modul.
 *
 * Calcium/Eisen/Vitamin C wurden für das Chart aus Instruktion 5 ergänzt,
 * siehe `features/charts/nutrientComparisonChart.ts` für die Auswahlbegründung.
 * Vitamin B12/Folat kamen mit Instruktion 23 dazu. Sie werden defensiv
 * gelesen (`?.`), damit ein Eintrag ohne `vitamins`-Objekt (z.B. sehr alte
 * eigene Zutat oder Fremd-Import) nicht abstürzt, sondern als "kein Wert"
 * (`incomplete: true`) zählt.
 *
 * Die Fettsäuren 'saturatedFat', 'monounsaturatedFat' und
 * 'polyunsaturatedFat' (g, Instruktion 24) sind eine reine Aufschlüsselung
 * des Fetts für die Nährwerttabelle: Für sie gibt es bewusst keinen
 * Referenzwert (die DGE empfiehlt nur qualitativ "weniger gesättigte, mehr
 * ungesättigte Fettsäuren"), "% Tagesbedarf" bleibt deshalb leer. Die
 * ungesättigten Felder sind im Modell optional, daher `?? null`.
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
  { nutrientId: 'calcium', unit: 'mg', getPer100g: (food) => food.minerals.calcium.value },
  { nutrientId: 'iron', unit: 'mg', getPer100g: (food) => food.minerals.iron.value },
  { nutrientId: 'vitaminC', unit: 'mg', getPer100g: (food) => food.vitamins.c.value },
  {
    nutrientId: 'vitaminB12',
    unit: 'µg',
    getPer100g: (food) => food.vitamins?.b12Cobalamin?.value ?? null,
  },
  { nutrientId: 'folate', unit: 'µg', getPer100g: (food) => food.vitamins?.folate?.value ?? null },
  { nutrientId: 'saturatedFat', unit: 'g', getPer100g: (food) => food.saturatedFat ?? null },
  {
    nutrientId: 'monounsaturatedFat',
    unit: 'g',
    getPer100g: (food) => food.monounsaturatedFat ?? null,
  },
  {
    nutrientId: 'polyunsaturatedFat',
    unit: 'g',
    getPer100g: (food) => food.polyunsaturatedFat ?? null,
  },
]

/**
 * Kernfunktion: summiert Nährwerte für eine beliebige Zutatenliste (nicht an
 * `Recipe` gebunden — wird z.B. auch für Menüs aus Instruktion 6 verwendet,
 * die keine `servings`/`instructions` haben).
 */
export function calculateNutrition(
  ingredients: RecipeIngredient[],
  foodsById: Map<string, FoodItem>,
): NutrientValues {
  return NUTRIENT_DEFINITIONS.map(({ nutrientId, unit, getPer100g }): NutrientAmount => {
    let value = 0
    let incomplete = false

    for (const ingredient of ingredients) {
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

export interface NovaSummary {
  /** Höchste (am stärksten verarbeitete) bekannte Nova-Gruppe unter den Zutaten, oder `null`, wenn keine Zutat eine Angabe hat. */
  group: 1 | 2 | 3 | 4 | null
  /** `true`, wenn für mindestens eine Zutat keine Nova-Gruppe hinterlegt ist (oder die Zutat selbst fehlt). */
  incomplete: boolean
}

/**
 * Nova-Klassifikation einer Zutatenliste (Instruktion 17) — bewusst
 * unabhängig von `amountGrams`/Portionen, da Nova die Art der Zutat
 * bewertet, nicht deren Menge (anders als `calculateNutrition`). Deshalb
 * bei Rezepten direkt mit `recipe.ingredients` aufrufen, nicht über
 * `calculatePerServing`.
 */
export function calculateNovaGroup(
  ingredients: RecipeIngredient[],
  foodsById: Map<string, FoodItem>,
): NovaSummary {
  let group: 1 | 2 | 3 | 4 | null = null
  let incomplete = false

  for (const ingredient of ingredients) {
    const food = foodsById.get(ingredient.foodId)
    const novaGroup = food?.novaGroup
    if (!food || novaGroup === undefined || novaGroup === null) {
      incomplete = true
      continue
    }
    if (group === null || novaGroup > group) {
      group = novaGroup
    }
  }

  return { group, incomplete }
}

/** Ein Rezept entspricht immer genau einer Portion (Instruktion 19) — keine Division mehr nötig, wie früher bei `calculatePerServing`. */
export function calculateRecipeNutrition(
  recipe: Recipe,
  foodsById: Map<string, FoodItem>,
): NutrientValues {
  return calculateNutrition(recipe.ingredients, foodsById)
}
