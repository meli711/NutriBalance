import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  HISTORY_NUTRIENT_IDS,
  NUTRIENT_LABELS,
  SUB_NUTRIENT_PARENT,
  orderForNutritionTable,
} from './nutrientLabels.ts'
import type { NutrientValues } from '../features/recipes/models/nutritionValues.ts'

function values(...ids: string[]): NutrientValues {
  return ids.map((nutrientId) => ({ nutrientId, unit: 'g', value: 1, incomplete: false }))
}

function ids(list: NutrientValues): string[] {
  return list.map((v) => v.nutrientId)
}

test('orderForNutritionTable stellt die Fettsäuren direkt hinter Fett, Rest unverändert', () => {
  const input = values(
    'energy',
    'protein',
    'fat',
    'carbohydrates',
    'folate',
    'saturatedFat',
    'monounsaturatedFat',
    'polyunsaturatedFat',
  )
  assert.deepEqual(ids(orderForNutritionTable(input)), [
    'energy',
    'protein',
    'fat',
    'saturatedFat',
    'monounsaturatedFat',
    'polyunsaturatedFat',
    'carbohydrates',
    'folate',
  ])
})

test('orderForNutritionTable: ohne Unter-Nährstoffe bleibt die Reihenfolge identisch', () => {
  const input = values('energy', 'protein', 'fat', 'vitaminB12')
  assert.deepEqual(ids(orderForNutritionTable(input)), ['energy', 'protein', 'fat', 'vitaminB12'])
})

test('orderForNutritionTable: Unter-Nährstoffe ohne Oberbegriff landen am Ende, nichts geht verloren', () => {
  const input = values('saturatedFat', 'energy', 'protein')
  assert.deepEqual(ids(orderForNutritionTable(input)), ['energy', 'protein', 'saturatedFat'])
})

test('HISTORY_NUTRIENT_IDS enthält alle Labels ausser den Unter-Nährstoffen, in Label-Reihenfolge', () => {
  for (const id of Object.keys(SUB_NUTRIENT_PARENT)) {
    assert.ok(id in NUTRIENT_LABELS, `${id} braucht ein Label`)
    assert.equal(HISTORY_NUTRIENT_IDS.includes(id), false)
  }
  assert.deepEqual(HISTORY_NUTRIENT_IDS, [
    'energy',
    'protein',
    'fat',
    'carbohydrates',
    'fiber',
    'calcium',
    'iron',
    'vitaminC',
    'vitaminB12',
    'folate',
  ])
})
