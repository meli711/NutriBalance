import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sumDailyNutrition } from './dailyNutritionService.ts'
import type { DailyLogContext } from './dailyNutritionService.ts'
import type { FoodItem, FoodMinerals, FoodVitamins } from '../../data/models/food.ts'
import type { Recipe } from '../recipes/models/recipe.ts'
import type { Menu } from '../menu-builder/models/menu.ts'
import type { LogEntry } from './models/logEntry.ts'

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

// Werte pro 100g, von Hand nachrechenbar (siehe Kommentare je Nährstoff unten).
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
  protein: null, // absichtlich fehlend → Tages-Protein muss incomplete werden
  fat: 1,
  carbohydrates: 10,
  fiber: 0,
})

const RECIPE_X: Recipe = {
  id: 'recipe-x',
  name: 'Testrezept X',
  servings: 1,
  ingredients: [{ foodId: 'A', amountGrams: 100 }],
}

const MENU_Y: Menu = {
  id: 'menu-y',
  name: 'Testmenü Y',
  description: '',
  createdAt: new Date(0).toISOString(),
  ingredients: [{ foodId: 'A', amountGrams: 50 }],
}

const CONTEXT: DailyLogContext = {
  foodsById: new Map([
    ['A', FOOD_A],
    ['B', FOOD_B],
  ]),
  recipesById: new Map([['recipe-x', RECIPE_X]]),
  menusById: new Map([['menu-y', MENU_Y]]),
}

function find(values: ReturnType<typeof sumDailyNutrition>, nutrientId: string) {
  const amount = values.find((v) => v.nutrientId === nutrientId)
  assert.ok(amount, `nutrientId ${nutrientId} nicht im Ergebnis gefunden`)
  return amount
}

test('sumDailyNutrition summiert Rezept + Zutat + Menü an einem Tag korrekt', () => {
  const entries: LogEntry[] = [
    // Rezept X: 1 Portion = 100g von A. 2x gegessen → alles verdoppelt.
    { id: 'e1', date: '2026-08-22', type: 'recipe', recipeId: 'recipe-x', servings: 2 },
    // Zutat: 50g von B direkt geloggt.
    { id: 'e2', date: '2026-08-22', type: 'food', foodId: 'B', amountGrams: 50 },
    // Menü Y: 50g von A (kein Multiplikator).
    { id: 'e3', date: '2026-08-22', type: 'menu', menuId: 'menu-y' },
  ]

  const total = sumDailyNutrition(entries, CONTEXT)

  // Energie: Rezept (200*2=400) + Zutat (100/100*50=50) + Menü (200/100*50=100) = 550
  assert.equal(find(total, 'energy').value, 550)

  // Fett: Rezept (5*2=10) + Zutat (1/100*50=0.5) + Menü (5/100*50=2.5) = 13
  assert.equal(find(total, 'fat').value, 13)

  // Kohlenhydrate: Rezept (20*2=40) + Zutat (10/100*50=5) + Menü (20/100*50=10) = 55
  assert.equal(find(total, 'carbohydrates').value, 55)

  // Ballaststoffe: Rezept (2*2=4) + Zutat (0) + Menü (2/100*50=1) = 5
  assert.equal(find(total, 'fiber').value, 5)

  // Protein: Rezept (10*2=20) + Zutat (B hat keinen Wert → 0, aber incomplete) + Menü (10/100*50=5) = 25
  assert.equal(find(total, 'protein').value, 25)
  assert.equal(find(total, 'protein').incomplete, true)

  // Andere Nährstoffe bleiben vollständig (kein Beitrag war unvollständig).
  assert.equal(find(total, 'energy').incomplete, false)
})

test('sumDailyNutrition ignoriert Einträge mit nicht mehr existierendem Rezept/Menü/Zutat statt abzustürzen', () => {
  const entries: LogEntry[] = [
    { id: 'e1', date: '2026-08-22', type: 'recipe', recipeId: 'does-not-exist', servings: 1 },
    { id: 'e2', date: '2026-08-22', type: 'menu', menuId: 'does-not-exist' },
    { id: 'e3', date: '2026-08-22', type: 'food', foodId: 'does-not-exist', amountGrams: 100 },
    { id: 'e4', date: '2026-08-22', type: 'food', foodId: 'A', amountGrams: 100 },
  ]

  const total = sumDailyNutrition(entries, CONTEXT)

  // Nur e4 (Zutat A) liefert einen Beitrag; die anderen drei werden übersprungen.
  assert.equal(find(total, 'energy').value, 200)
  assert.equal(find(total, 'energy').incomplete, false)
})

test('sumDailyNutrition liefert ein leeres Array für einen Tag ohne Einträge', () => {
  assert.deepEqual(sumDailyNutrition([], CONTEXT), [])
})
