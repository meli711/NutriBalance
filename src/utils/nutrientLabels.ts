import type { NutrientValues } from '../features/recipes/models/nutritionValues.ts'

/**
 * Deutsche Anzeige-Labels für die Nährstoff-IDs/Einheiten, die sowohl in
 * `NutrientRequirement` (Bedarf, Instruktion 2) als auch in `NutrientValues`
 * (Aufnahme, Instruktion 4) verwendet werden — an einer Stelle gepflegt,
 * damit Bedarf- und Aufnahme-Anzeige nicht auseinanderlaufen.
 */
export const NUTRIENT_LABELS: Record<string, string> = {
  energy: 'Energie',
  protein: 'Protein',
  fat: 'Fett',
  carbohydrates: 'Kohlenhydrate',
  fiber: 'Ballaststoffe',
  calcium: 'Calcium',
  iron: 'Eisen',
  vitaminC: 'Vitamin C',
  vitaminB12: 'Vitamin B12',
  folate: 'Folat',
  saturatedFat: 'gesättigte Fettsäuren',
  monounsaturatedFat: 'einfach ungesättigte Fettsäuren',
  polyunsaturatedFat: 'mehrfach ungesättigte Fettsäuren',
}

/**
 * Unter-Nährstoffe → Oberbegriff (Instruktion 24). Sie werden in der
 * Nährwerttabelle als "davon …" direkt unter dem Oberbegriff angezeigt und
 * sind reine Aufschlüsselung ohne Referenzwert, daher nicht im Verlauf
 * wählbar (siehe `HISTORY_NUTRIENT_IDS`).
 */
export const SUB_NUTRIENT_PARENT: Record<string, string> = {
  saturatedFat: 'fat',
  monounsaturatedFat: 'fat',
  polyunsaturatedFat: 'fat',
}

/** Im Verlauf wählbare Nährstoffe: alle aus `NUTRIENT_LABELS` ohne Unter-Nährstoffe, Reihenfolge wie dort. */
export const HISTORY_NUTRIENT_IDS: string[] = Object.keys(NUTRIENT_LABELS).filter(
  (id) => !(id in SUB_NUTRIENT_PARENT),
)

/**
 * Reihenfolge für die Nährwerttabelle: Unter-Nährstoffe stehen direkt nach
 * ihrem Oberbegriff, alles andere bleibt in der Reihenfolge der Eingabe
 * (= `NUTRIENT_DEFINITIONS`). Ein Unter-Nährstoff, dessen Oberbegriff nicht
 * in der Liste ist, wird ans Ende gestellt statt zu verschwinden.
 */
export function orderForNutritionTable(values: NutrientValues): NutrientValues {
  const presentIds = new Set(values.map((v) => v.nutrientId))
  const ordered: NutrientValues = []
  for (const value of values) {
    if (value.nutrientId in SUB_NUTRIENT_PARENT) continue
    ordered.push(value)
    ordered.push(...values.filter((v) => SUB_NUTRIENT_PARENT[v.nutrientId] === value.nutrientId))
  }
  ordered.push(
    ...values.filter((v) => {
      const parent = SUB_NUTRIENT_PARENT[v.nutrientId]
      return parent !== undefined && !presentIds.has(parent)
    }),
  )
  return ordered
}

export const UNIT_LABELS: Record<string, string> = {
  kcal: 'kcal',
  g: 'g',
  mg: 'mg',
  // U+00B5 MICRO SIGN, identisch mit `food.ts`/`customFoodService.ts`
  µg: 'µg',
  '%energy': '% der Energie',
  'g/1000kcal': 'g pro 1000 kcal',
}
