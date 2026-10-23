import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateDailyRequirementPercentage } from './dailyRequirementPercentage.ts'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import type { NutrientValues } from './models/nutritionValues.ts'
import type { FoodItem } from '../../data/models/food.ts'
import type { UserProfile } from '../../data/models/userProfile.ts'
import { calculateNutrition } from './nutritionCalculator.ts'
import { createCustomFood } from '../../data/customFoodService.ts'
import { getRequirementsForProfile } from '../nutrient-requirements/requirementService.ts'

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

test('Vitamin B12: 2 µg bei Bedarf 4 µg ergibt 50 % (Einheit aus Berechnung = Referenzwert)', () => {
  const profile: UserProfile = { age: 30, heightCm: 165, gender: 'female' }
  const requirements = getRequirementsForProfile(profile)
  const base = createCustomFood({
    name: 'B12-Test',
    category: '',
    energyKcal: null,
    protein: null,
    fat: null,
    saturatedFat: null,
    carbohydrates: null,
    sugar: null,
    fiber: null,
    novaGroup: null,
  })
  const food: FoodItem = {
    ...base,
    id: 'b12-test',
    vitamins: {
      ...base.vitamins,
      b12Cobalamin: { value: 2, unit: 'µg' },
      folate: { value: 150, unit: 'µg' },
    },
  }
  // Echte Berechnung + echte Referenzwerte, damit ein abweichendes µ-Zeichen auffallen würde.
  const intake = calculateNutrition(
    [{ foodId: 'b12-test', amountGrams: 100 }],
    new Map([['b12-test', food]]),
  ).filter((v) => v.nutrientId === 'vitaminB12' || v.nutrientId === 'folate')

  const b12Intake = intake.find((v) => v.nutrientId === 'vitaminB12')
  const b12Requirement = requirements.find((r) => r.nutrientId === 'vitaminB12')
  assert.equal(b12Intake?.unit, b12Requirement?.unit)
  assert.equal(b12Intake?.unit.codePointAt(0), 0x00b5)

  const result = calculateDailyRequirementPercentage(intake, requirements)
  assert.equal(result.get('vitaminB12'), 50) // 2/4
  assert.equal(result.get('folate'), 50) // 150/300
})

test('Fettsäuren (Instruktion 24) haben keinen Referenzwert und ergeben null', () => {
  const profile: UserProfile = { age: 30, heightCm: 165, gender: 'female' }
  const perServing: NutrientValues = [
    { nutrientId: 'saturatedFat', unit: 'g', value: 10, incomplete: false },
    { nutrientId: 'monounsaturatedFat', unit: 'g', value: 10, incomplete: false },
    { nutrientId: 'polyunsaturatedFat', unit: 'g', value: 10, incomplete: false },
  ]
  const result = calculateDailyRequirementPercentage(perServing, getRequirementsForProfile(profile))
  assert.equal(result.get('saturatedFat'), null)
  assert.equal(result.get('monounsaturatedFat'), null)
  assert.equal(result.get('polyunsaturatedFat'), null)
})
