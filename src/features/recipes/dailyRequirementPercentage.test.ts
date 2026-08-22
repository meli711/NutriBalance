import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateDailyRequirementPercentage } from './dailyRequirementPercentage.ts'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import type { NutrientValues } from './models/nutritionValues.ts'

function requirement(
  overrides: Partial<NutrientRequirement> & { nutrientId: string },
): NutrientRequirement {
  return {
    unit: 'g',
    referenceType: 'richtwert',
    source: 'test',
    ...overrides,
  }
}

const REQUIREMENTS: NutrientRequirement[] = [
  requirement({ nutrientId: 'energy', unit: 'kcal', recommended: 2000 }),
  requirement({ nutrientId: 'protein', unit: 'g', recommended: 50 }),
  requirement({ nutrientId: 'fat', unit: '%energy', recommended: 30 }),
  requirement({ nutrientId: 'carbohydrates', unit: '%energy', min: 50 }),
  requirement({ nutrientId: 'fiber', unit: 'g/1000kcal', min: 14.6 }),
]

test('berechnet direkten Prozentsatz bei übereinstimmender Einheit', () => {
  const perServing: NutrientValues = [
    { nutrientId: 'energy', unit: 'kcal', value: 500, incomplete: false },
    { nutrientId: 'protein', unit: 'g', value: 25, incomplete: false },
  ]

  const result = calculateDailyRequirementPercentage(perServing, REQUIREMENTS)
  assert.equal(result.get('energy'), 25) // 500/2000
  assert.equal(result.get('protein'), 50) // 25/50
})

test('rechnet %energy-Referenzwerte über den Energiebedarf in Gramm um', () => {
  const perServing: NutrientValues = [
    { nutrientId: 'fat', unit: 'g', value: 20, incomplete: false },
    { nutrientId: 'carbohydrates', unit: 'g', value: 62.5, incomplete: false },
  ]

  const result = calculateDailyRequirementPercentage(perServing, REQUIREMENTS)
  // Fett-Zielwert: 30% von 2000kcal / 9 kcal/g = 66.67g → 20/66.67 = 30%
  assert.equal(Math.round(result.get('fat')!), 30)
  // Kohlenhydrate-Zielwert: 50% von 2000kcal / 4 kcal/g = 250g → 62.5/250 = 25%
  assert.equal(result.get('carbohydrates'), 25)
})

test('gibt null zurück, wenn keine Einheiten-Umrechnung möglich ist (g/1000kcal)', () => {
  const perServing: NutrientValues = [
    { nutrientId: 'fiber', unit: 'g', value: 5, incomplete: false },
  ]
  const result = calculateDailyRequirementPercentage(perServing, REQUIREMENTS)
  assert.equal(result.get('fiber'), null)
})

test('gibt null zurück, wenn kein Referenzwert für den Nährstoff existiert', () => {
  const perServing: NutrientValues = [
    { nutrientId: 'unknown', unit: 'g', value: 5, incomplete: false },
  ]
  const result = calculateDailyRequirementPercentage(perServing, REQUIREMENTS)
  assert.equal(result.get('unknown'), null)
})
