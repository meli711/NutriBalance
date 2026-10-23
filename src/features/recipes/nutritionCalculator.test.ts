import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateNovaGroup,
  calculateNutrition,
  calculateRecipeNutrition,
} from './nutritionCalculator.ts'
import type { FoodItem, FoodMinerals, FoodVitamins } from '../../data/models/food.ts'
import type { Recipe } from './models/recipe.ts'
import { isValidCustomFoodItem } from '../../data/customFoodService.ts'

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

// --- Vitamin B12 / Folat (Instruktion 23) ---

function withVitamins(b12: number | null, folate: number | null): FoodVitamins {
  return {
    ...EMPTY_VITAMINS,
    b12Cobalamin: { value: b12, unit: 'µg' },
    folate: { value: folate, unit: 'µg' },
  }
}

test('Vitamin B12 und Folat werden in µg korrekt summiert', () => {
  const foods = new Map([
    ['leber', makeFood({ id: 'leber', vitamins: withVitamins(60, 200) })],
    ['spinat', makeFood({ id: 'spinat', vitamins: withVitamins(0, 150) })],
  ])
  const total = calculateNutrition(
    [
      { foodId: 'leber', amountGrams: 50 },
      { foodId: 'spinat', amountGrams: 200 },
    ],
    foods,
  )

  // B12: (60/100*50) + (0/100*200) = 30
  assert.deepEqual(find(total, 'vitaminB12'), {
    nutrientId: 'vitaminB12',
    unit: 'µg',
    value: 30,
    incomplete: false,
  })
  // Folat: (200/100*50) + (150/100*200) = 100 + 300 = 400
  assert.deepEqual(find(total, 'folate'), {
    nutrientId: 'folate',
    unit: 'µg',
    value: 400,
    incomplete: false,
  })
})

test('Vitamin B12/Folat mit value null ergibt incomplete: true', () => {
  const foods = new Map([['x', makeFood({ id: 'x', vitamins: withVitamins(null, null) })]])
  const total = calculateNutrition([{ foodId: 'x', amountGrams: 100 }], foods)
  assert.equal(find(total, 'vitaminB12').incomplete, true)
  assert.equal(find(total, 'folate').incomplete, true)
})

test('Lebensmittel ohne B12-/Folat-Feld im vitamins-Objekt stürzt nicht ab und ergibt incomplete: true', () => {
  // Simuliert eine sehr alte eigene Zutat oder einen Fremd-Import, bei dem die
  // Felder fehlen. `isValidCustomFoodItem` prüft nur, dass `vitamins` ein
  // Objekt ist, nicht welche Felder es enthält — dieser Fall ist also möglich.
  const vitaminsWithoutB12Folate: Partial<FoodVitamins> = { ...EMPTY_VITAMINS }
  delete vitaminsWithoutB12Folate.b12Cobalamin
  delete vitaminsWithoutB12Folate.folate
  const legacy = makeFood({
    id: 'legacy',
    energyKcal: 100,
    vitamins: vitaminsWithoutB12Folate as FoodVitamins,
  })
  const foods = new Map([['legacy', legacy]])

  const total = calculateNutrition([{ foodId: 'legacy', amountGrams: 100 }], foods)
  assert.equal(find(total, 'vitaminB12').incomplete, true)
  assert.equal(find(total, 'vitaminB12').value, 0)
  assert.equal(find(total, 'folate').incomplete, true)
  assert.equal(find(total, 'folate').value, 0)
  assert.equal(find(total, 'energy').value, 100)
})

test('Lebensmittel ganz ohne vitamins-Objekt wird von isValidCustomFoodItem abgewiesen (erreicht die Berechnung nie)', () => {
  const withoutVitamins: Partial<FoodItem> = makeFood({ id: 'custom-local-x' })
  delete withoutVitamins.vitamins
  assert.equal(isValidCustomFoodItem(withoutVitamins), false)
})

test('die bestehenden 8 Nährstoffe bleiben in Reihenfolge, Einheit und Wert unverändert', () => {
  const food = makeFood({
    id: 'voll',
    energyKcal: 200,
    protein: 10,
    fat: 5,
    carbohydrates: 20,
    fiber: 2,
    minerals: {
      ...EMPTY_MINERALS,
      calcium: { value: 120, unit: 'mg' },
      iron: { value: 2, unit: 'mg' },
    },
    vitamins: { ...withVitamins(1, 50), c: { value: 30, unit: 'mg' } },
  })
  const total = calculateNutrition([{ foodId: 'voll', amountGrams: 50 }], new Map([['voll', food]]))

  assert.deepEqual(total.slice(0, 8), [
    { nutrientId: 'energy', unit: 'kcal', value: 100, incomplete: false },
    { nutrientId: 'protein', unit: 'g', value: 5, incomplete: false },
    { nutrientId: 'fat', unit: 'g', value: 2.5, incomplete: false },
    { nutrientId: 'carbohydrates', unit: 'g', value: 10, incomplete: false },
    { nutrientId: 'fiber', unit: 'g', value: 1, incomplete: false },
    { nutrientId: 'calcium', unit: 'mg', value: 60, incomplete: false },
    { nutrientId: 'iron', unit: 'mg', value: 1, incomplete: false },
    { nutrientId: 'vitaminC', unit: 'mg', value: 15, incomplete: false },
  ])
  assert.deepEqual(
    total.slice(8, 10).map((v) => v.nutrientId),
    ['vitaminB12', 'folate'],
  )
  // Instruktion 24: Fettsäuren hinten angehängt, B12/Folat bleiben an Position 8/9.
  assert.deepEqual(
    total.slice(10).map((v) => v.nutrientId),
    ['saturatedFat', 'monounsaturatedFat', 'polyunsaturatedFat'],
  )
})

// --- Fettsäuren (Instruktion 24) ---

test('gesättigte, einfach und mehrfach ungesättigte Fettsäuren werden in g summiert', () => {
  const foods = new Map([
    [
      'oel',
      makeFood({
        id: 'oel',
        fat: 100,
        saturatedFat: 14,
        monounsaturatedFat: 73,
        polyunsaturatedFat: 11,
      }),
    ],
    [
      'butter',
      makeFood({
        id: 'butter',
        fat: 82,
        saturatedFat: 52,
        monounsaturatedFat: 20,
        polyunsaturatedFat: 2,
      }),
    ],
  ])
  const total = calculateNutrition(
    [
      { foodId: 'oel', amountGrams: 10 },
      { foodId: 'butter', amountGrams: 50 },
    ],
    foods,
  )

  // gesättigt: 1.4 + 26 = 27.4; einfach: 7.3 + 10 = 17.3; mehrfach: 1.1 + 1 = 2.1
  assert.equal(Math.round(find(total, 'saturatedFat').value * 10) / 10, 27.4)
  assert.equal(Math.round(find(total, 'monounsaturatedFat').value * 10) / 10, 17.3)
  assert.equal(Math.round(find(total, 'polyunsaturatedFat').value * 10) / 10, 2.1)
  for (const id of ['saturatedFat', 'monounsaturatedFat', 'polyunsaturatedFat']) {
    assert.equal(find(total, id).unit, 'g')
    assert.equal(find(total, id).incomplete, false)
  }
})

test('fehlende ungesättigte Fettsäuren (z.B. eigene Zutat von vor Instruktion 24) ergeben incomplete: true ohne Absturz', () => {
  // `makeFood` setzt monounsaturatedFat/polyunsaturatedFat gar nicht — wie bei
  // bestehenden eigenen Zutaten im localStorage.
  const food = makeFood({ id: 'alt', fat: 10, saturatedFat: 4 })
  assert.equal('monounsaturatedFat' in food, false)

  const total = calculateNutrition([{ foodId: 'alt', amountGrams: 100 }], new Map([['alt', food]]))
  assert.deepEqual(find(total, 'saturatedFat'), {
    nutrientId: 'saturatedFat',
    unit: 'g',
    value: 4,
    incomplete: false,
  })
  assert.equal(find(total, 'monounsaturatedFat').incomplete, true)
  assert.equal(find(total, 'monounsaturatedFat').value, 0)
  assert.equal(find(total, 'polyunsaturatedFat').incomplete, true)
  assert.equal(find(total, 'fat').value, 10)
})
