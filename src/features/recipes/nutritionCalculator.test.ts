import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculatePerServing, calculateRecipeNutrition } from './nutritionCalculator.ts'
import type { FoodItem, FoodMinerals, FoodVitamins } from '../../data/models/food.ts'
import type { Recipe } from './models/recipe.ts'

function zeroNutrient(unit: string) {
  return { value: 0, unit }
}

const EMPTY_VITAMINS: FoodVitamins = {
  aRetinolEquivalent: zeroNutrient('µg'),
  aRetinolActivityEquivalent: zeroNutrient('µg'),
  retinol: zeroNutrient('µg'),
  betaCaroteneActivity: zeroNutrient('µg'),
  betaCarotene: zeroNutrient('µg'),
  b1Thiamin: zeroNutrient('mg'),
  b2Riboflavin: zeroNutrient('mg'),
  b6Pyridoxin: zeroNutrient('mg'),
  b12Cobalamin: zeroNutrient('µg'),
  niacinEquivalent: zeroNutrient('mg'),
  niacin: zeroNutrient('mg'),
  folate: zeroNutrient('µg'),
  pantothenicAcid: zeroNutrient('mg'),
  c: zeroNutrient('mg'),
  d: zeroNutrient('µg'),
  e: zeroNutrient('mg'),
}

const EMPTY_MINERALS: FoodMinerals = {
  potassium: zeroNutrient('mg'),
  sodium: zeroNutrient('mg'),
  chloride: zeroNutrient('mg'),
  calcium: zeroNutrient('mg'),
  magnesium: zeroNutrient('mg'),
  phosphorus: zeroNutrient('mg'),
  iron: zeroNutrient('mg'),
  iodine: zeroNutrient('µg'),
  zinc: zeroNutrient('mg'),
  selenium: zeroNutrient('µg'),
  salt: zeroNutrient('g'),
}

function makeFood(overrides: Partial<FoodItem> & { id: string }): FoodItem {
  return {
    name: { de: overrides.id },
    category: 'Test',
    energyKcal: null,
    protein: null,
    fat: null,
    saturatedFat: null,
    carbohydrates: null,
    sugar: null,
    fiber: null,
    water: null,
    alcohol: null,
    vitamins: EMPTY_VITAMINS,
    minerals: EMPTY_MINERALS,
    ...overrides,
  }
}

// Werte von Hand nachrechenbar (siehe Kommentare je Nährstoff).
const FOOD_A = makeFood({
  id: 'A',
  energyKcal: 200,
  protein: 10,
  fat: 5,
  carbohydrates: 20,
  fiber: 2,
})
const FOOD_B = makeFood({
  id: 'B',
  energyKcal: 100,
  protein: null, // absichtlich fehlend, siehe incomplete-Assertions unten
  fat: 1,
  carbohydrates: 10,
  fiber: 0,
})

const FOODS = new Map([
  ['A', FOOD_A],
  ['B', FOOD_B],
])

// 200g von A + 50g von B, 2 Portionen.
const RECIPE: Recipe = {
  id: 'test-recipe',
  name: 'Testrezept',
  servings: 2,
  ingredients: [
    { foodId: 'A', amountGrams: 200 },
    { foodId: 'B', amountGrams: 50 },
  ],
}

function find(values: ReturnType<typeof calculateRecipeNutrition>, nutrientId: string) {
  const amount = values.find((v) => v.nutrientId === nutrientId)
  assert.ok(amount, `nutrientId ${nutrientId} nicht im Ergebnis gefunden`)
  return amount
}

test('calculateRecipeNutrition summiert und skaliert Nährwerte pro Zutat', () => {
  const total = calculateRecipeNutrition(RECIPE, FOODS)

  // Energie: (200/100*200) + (100/100*50) = 400 + 50 = 450
  assert.equal(find(total, 'energy').value, 450)
  assert.equal(find(total, 'energy').incomplete, false)

  // Fett: (5/100*200) + (1/100*50) = 10 + 0.5 = 10.5
  assert.equal(find(total, 'fat').value, 10.5)

  // Kohlenhydrate: (20/100*200) + (10/100*50) = 40 + 5 = 45
  assert.equal(find(total, 'carbohydrates').value, 45)

  // Ballaststoffe: (2/100*200) + (0/100*50) = 4 + 0 = 4
  assert.equal(find(total, 'fiber').value, 4)

  // Protein: nur A liefert einen Wert (20), B ist null → als unvollständig markiert
  assert.equal(find(total, 'protein').value, 20)
  assert.equal(find(total, 'protein').incomplete, true)
})

test('calculatePerServing teilt durch die Anzahl Portionen', () => {
  const perServing = calculatePerServing(RECIPE, FOODS)

  assert.equal(find(perServing, 'energy').value, 225) // 450 / 2
  assert.equal(find(perServing, 'fat').value, 5.25) // 10.5 / 2
  assert.equal(find(perServing, 'carbohydrates').value, 22.5) // 45 / 2
  assert.equal(find(perServing, 'fiber').value, 2) // 4 / 2
  assert.equal(find(perServing, 'protein').value, 10) // 20 / 2
  assert.equal(find(perServing, 'protein').incomplete, true) // bleibt unvollständig
})

test('unbekannte foodId markiert alle Nährstoffe als unvollständig', () => {
  const recipeWithUnknownFood: Recipe = {
    id: 'unknown-food-recipe',
    name: 'Rezept mit unbekannter Zutat',
    servings: 1,
    ingredients: [{ foodId: 'does-not-exist', amountGrams: 100 }],
  }

  const total = calculateRecipeNutrition(recipeWithUnknownFood, FOODS)
  for (const amount of total) {
    assert.equal(amount.incomplete, true)
    assert.equal(amount.value, 0)
  }
})
