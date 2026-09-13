import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeFoods, rankFoodsByQuery } from './foodDatabaseService.ts'
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

test('mergeFoods gibt die generische Liste unverändert zurück, wenn es keine eigenen Zutaten gibt', () => {
  const generic = [makeFood('198', 'Reis')]
  assert.equal(mergeFoods(generic, []), generic)
})

test('mergeFoods ersetzt einen generischen Eintrag an Ort und Stelle bei gleicher id', () => {
  const generic = [makeFood('198', 'Reis'), makeFood('199', 'Weizenmehl')]
  const custom = makeFood('198', 'Reis (eigene Angabe)')

  const merged = mergeFoods(generic, [custom])

  assert.deepEqual(
    merged.map((f) => f.name.de),
    ['Reis (eigene Angabe)', 'Weizenmehl'],
  )
})

test('mergeFoods hängt eigene Zutaten mit neuer id an', () => {
  const generic = [makeFood('198', 'Reis')]
  const custom = makeFood('custom-local-1', 'Skyr Natur')

  const merged = mergeFoods(generic, [custom])

  assert.deepEqual(
    merged.map((f) => f.id),
    ['198', 'custom-local-1'],
  )
})
