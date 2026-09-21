import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateNovaGroup,
  calculateNutrition,
  calculateRecipeNutrition,
} from './nutritionCalculator.ts'
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

// 200g von A + 50g von B (= 1 Portion, siehe Instruktion 19).
const RECIPE: Recipe = {
  id: 'test-recipe',
  name: 'Testrezept',
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

test('calculateNutrition funktioniert mit einer reinen Zutatenliste (z.B. für Menüs ohne Recipe)', () => {
  // 100g von A + 100g von B, manuell zu einem "Menü" zusammengestellt.
  const total = calculateNutrition(
    [
      { foodId: 'A', amountGrams: 100 },
      { foodId: 'B', amountGrams: 100 },
    ],
    FOODS,
  )

  // Energie: (200/100*100) + (100/100*100) = 200 + 100 = 300
  assert.equal(find(total, 'energy').value, 300)
  // Kohlenhydrate: (20/100*100) + (10/100*100) = 20 + 10 = 30
  assert.equal(find(total, 'carbohydrates').value, 30)
})

test('unbekannte foodId markiert alle Nährstoffe als unvollständig', () => {
  const recipeWithUnknownFood: Recipe = {
    id: 'unknown-food-recipe',
    name: 'Rezept mit unbekannter Zutat',
    ingredients: [{ foodId: 'does-not-exist', amountGrams: 100 }],
  }

  const total = calculateRecipeNutrition(recipeWithUnknownFood, FOODS)
  for (const amount of total) {
    assert.equal(amount.incomplete, true)
    assert.equal(amount.value, 0)
  }
})

// Nova-Klassifikation (Instruktion 17) — unabhängig von amountGrams, daher
// eigene, kleine Fixtures ohne Mengenbezug.
const FOOD_NOVA_2 = makeFood({ id: 'nova2', novaGroup: 2 })
const FOOD_NOVA_4 = makeFood({ id: 'nova4', novaGroup: 4 })
const FOOD_NOVA_3 = makeFood({ id: 'nova3', novaGroup: 3 })
const FOOD_NO_NOVA = makeFood({ id: 'no-nova' }) // novaGroup bleibt undefined

const NOVA_FOODS = new Map([
  ['nova2', FOOD_NOVA_2],
  ['nova4', FOOD_NOVA_4],
  ['nova3', FOOD_NOVA_3],
  ['no-nova', FOOD_NO_NOVA],
])

test('calculateNovaGroup: leere Zutatenliste ergibt group null, incomplete false', () => {
  assert.deepEqual(calculateNovaGroup([], NOVA_FOODS), { group: null, incomplete: false })
})

test('calculateNovaGroup: eine Zutat ohne novaGroup ergibt group null, incomplete true', () => {
  const result = calculateNovaGroup([{ foodId: 'no-nova', amountGrams: 100 }], NOVA_FOODS)
  assert.deepEqual(result, { group: null, incomplete: true })
})

test('calculateNovaGroup: nimmt die höchste bekannte Gruppe, unabhängig von amountGrams', () => {
  const result = calculateNovaGroup(
    [
      { foodId: 'nova2', amountGrams: 500 },
      { foodId: 'nova4', amountGrams: 1 },
    ],
    NOVA_FOODS,
  )
  assert.deepEqual(result, { group: 4, incomplete: false })
})

test('calculateNovaGroup: unbekannte foodId markiert als incomplete', () => {
  const result = calculateNovaGroup([{ foodId: 'does-not-exist', amountGrams: 100 }], NOVA_FOODS)
  assert.deepEqual(result, { group: null, incomplete: true })
})

test('calculateNovaGroup: bekannte Gruppe zählt trotz einzelner Lücke (incomplete zusätzlich true)', () => {
  const result = calculateNovaGroup(
    [
      { foodId: 'nova3', amountGrams: 100 },
      { foodId: 'does-not-exist', amountGrams: 100 },
    ],
    NOVA_FOODS,
  )
  assert.deepEqual(result, { group: 3, incomplete: true })
})
