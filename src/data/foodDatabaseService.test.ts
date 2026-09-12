import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankFoodsByQuery } from './foodDatabaseService.ts'
import type { FoodItem } from './models/food.ts'

function makeFood(id: string, nameDe: string, synonyms?: string[]): FoodItem {
  return {
    id,
    name: { de: nameDe },
    synonyms,
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
    vitamins: {} as FoodItem['vitamins'],
    minerals: {} as FoodItem['minerals'],
  }
}

test('rankFoodsByQuery findet "Ei, ganzes" als ersten Treffer bei der Suche nach "Ei"', () => {
  const foods = [
    makeFood('custom-reis', 'Reis, weiss, gekocht'),
    makeFood('custom-weizen', 'Weizenmehl'),
    makeFood('custom-eiweisspulver', 'Eiweisspulver'),
    makeFood('custom-ei-ganzes', 'Ei, ganzes', ['Ei', 'Hühnerei', 'Eier']),
  ]

  const results = rankFoodsByQuery(foods, 'Ei')

  assert.equal(results[0]?.id, 'custom-ei-ganzes')
})

test('rankFoodsByQuery ist case-insensitive und trimmt die Anfrage', () => {
  const foods = [makeFood('custom-ei-ganzes', 'Ei, ganzes', ['Ei'])]

  assert.equal(rankFoodsByQuery(foods, '  ei  ')[0]?.id, 'custom-ei-ganzes')
})

test('rankFoodsByQuery gibt leeres Array bei leerer Anfrage zurück', () => {
  const foods = [makeFood('custom-ei-ganzes', 'Ei, ganzes', ['Ei'])]

  assert.deepEqual(rankFoodsByQuery(foods, '   '), [])
})

test('rankFoodsByQuery findet reine Teilstring-Treffer weiterhin, aber nach exakten Treffern', () => {
  const foods = [
    makeFood('custom-reis', 'Reis, weiss, gekocht'),
    makeFood('custom-ei-ganzes', 'Ei, ganzes', ['Ei']),
  ]

  const results = rankFoodsByQuery(foods, 'ei')

  assert.deepEqual(
    results.map((f) => f.id),
    ['custom-ei-ganzes', 'custom-reis'],
  )
})
