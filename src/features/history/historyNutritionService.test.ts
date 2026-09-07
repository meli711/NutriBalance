import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sumNutritionByDate } from './historyNutritionService.ts'
import type { DailyLogContext } from '../daily-log/dailyNutritionService.ts'
import type { FoodItem, FoodMinerals, FoodVitamins } from '../../data/models/food.ts'
import type { LogEntry } from '../daily-log/models/logEntry.ts'

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

// A: vollständig, B: Protein fehlt absichtlich → macht das Tagesprotein incomplete.
const FOOD_A = makeFood({ id: 'A', energyKcal: 200, protein: 10 })
const FOOD_B = makeFood({ id: 'B', energyKcal: 100, protein: null })

const CONTEXT: DailyLogContext = {
  foodsById: new Map([
    ['A', FOOD_A],
    ['B', FOOD_B],
  ]),
  recipesById: new Map(),
  menusById: new Map(),
}

function value(values: ReturnType<typeof sumNutritionByDate>, date: string, nutrientId: string) {
  const day = values.get(date)
  assert.ok(day, `Datum ${date} fehlt in der Map`)
  const amount = day.find((v) => v.nutrientId === nutrientId)
  assert.ok(amount, `nutrientId ${nutrientId} fehlt für ${date}`)
  return amount
}

test('sumNutritionByDate summiert pro Tag getrennt und deckt den ganzen dates-Bereich ab', () => {
  const dates = ['2026-09-01', '2026-09-02', '2026-09-03']
  const entries: LogEntry[] = [
    { id: 'e1', date: '2026-09-01', type: 'food', foodId: 'A', amountGrams: 100 },
    { id: 'e2', date: '2026-09-01', type: 'food', foodId: 'A', amountGrams: 50 },
    { id: 'e3', date: '2026-09-03', type: 'food', foodId: 'A', amountGrams: 200 },
  ]

  const result = sumNutritionByDate(dates, entries, CONTEXT)

  assert.deepEqual([...result.keys()], dates)

  // 01.09.: 150g von A → Energie 300, Protein 15
  assert.equal(value(result, '2026-09-01', 'energy').value, 300)
  assert.equal(value(result, '2026-09-01', 'protein').value, 15)

  // 03.09.: 200g von A → Energie 400
  assert.equal(value(result, '2026-09-03', 'energy').value, 400)
})

test('sumNutritionByDate liefert [] für Tage ohne Log-Eintrag', () => {
  const dates = ['2026-09-01', '2026-09-02']
  const entries: LogEntry[] = [
    { id: 'e1', date: '2026-09-01', type: 'food', foodId: 'A', amountGrams: 100 },
  ]

  const result = sumNutritionByDate(dates, entries, CONTEXT)

  assert.deepEqual(result.get('2026-09-02'), [])
  assert.equal(result.has('2026-09-02'), true)
})

test('sumNutritionByDate ignoriert Einträge ausserhalb des dates-Arrays', () => {
  const dates = ['2026-09-02']
  const entries: LogEntry[] = [
    { id: 'e1', date: '2026-09-01', type: 'food', foodId: 'A', amountGrams: 100 },
    { id: 'e2', date: '2026-09-02', type: 'food', foodId: 'A', amountGrams: 100 },
  ]

  const result = sumNutritionByDate(dates, entries, CONTEXT)

  assert.deepEqual([...result.keys()], ['2026-09-02'])
  assert.equal(value(result, '2026-09-02', 'energy').value, 200)
})

test('sumNutritionByDate reicht das incomplete-Flag pro Tag weiter', () => {
  const dates = ['2026-09-01', '2026-09-02']
  const entries: LogEntry[] = [
    // B hat keinen Protein-Wert → Tag 1 Protein incomplete
    { id: 'e1', date: '2026-09-01', type: 'food', foodId: 'B', amountGrams: 100 },
    // A ist vollständig → Tag 2 Protein vollständig
    { id: 'e2', date: '2026-09-02', type: 'food', foodId: 'A', amountGrams: 100 },
  ]

  const result = sumNutritionByDate(dates, entries, CONTEXT)

  assert.equal(value(result, '2026-09-01', 'protein').incomplete, true)
  assert.equal(value(result, '2026-09-02', 'protein').incomplete, false)
})
