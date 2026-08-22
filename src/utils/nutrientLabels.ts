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
}

export const UNIT_LABELS: Record<string, string> = {
  kcal: 'kcal',
  g: 'g',
  mg: 'mg',
  '%energy': '% der Energie',
  'g/1000kcal': 'g pro 1000 kcal',
}
