import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_FOOD_ID_PREFIX,
  applyCustomFoodInput,
  createCustomFood,
  deleteCustomFood,
  getCustomFoods,
  isOwnCustomFoodId,
  isValidCustomFoodItem,
  parseStoredCustomFoods,
  saveCustomFoods,
  upsertCustomFood,
} from './customFoodService.ts'
import type { CustomFoodInput } from './customFoodService.ts'

// `localStorage` gibt es unter Node (ohne DOM) standardmässig nicht — analog
// zum Shim in `backupService.test.ts`.
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
}
;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()

const input: CustomFoodInput = {
  name: 'Skyr Natur',
  category: '',
  energyKcal: 63,
  protein: 11,
  fat: 0.2,
  saturatedFat: 0.1,
  carbohydrates: 4,
  sugar: 4,
  fiber: 0,
}

test('createCustomFood erzeugt eine FoodItem mit custom-local-Präfix und leeren Vitaminen/Mineralstoffen', () => {
  const food = createCustomFood(input)

  assert.ok(isOwnCustomFoodId(food.id))
  assert.ok(food.id.startsWith(CUSTOM_FOOD_ID_PREFIX))
  assert.equal(food.name.de, 'Skyr Natur')
  assert.equal(food.category, 'Eigene Zutaten') // Default, da input.category leer ist
  assert.equal(food.energyKcal, 63)
  assert.equal(food.water, null)
  assert.equal(food.alcohol, null)
  assert.equal(food.vitamins.c.value, null)
  assert.equal(food.minerals.calcium.value, null)
})

test('applyCustomFoodInput behält die id, überschreibt aber die Werte', () => {
  const existing = createCustomFood(input)
  const updated = applyCustomFoodInput(existing, { ...input, name: 'Skyr Vanille', energyKcal: 90 })

  assert.equal(updated.id, existing.id)
  assert.equal(updated.name.de, 'Skyr Vanille')
  assert.equal(updated.energyKcal, 90)
})

test('upsertCustomFood fügt neue Zutaten an und ersetzt bestehende an Ort und Stelle', () => {
  saveCustomFoods([])
  const first = createCustomFood(input)
  upsertCustomFood(first)
  assert.deepEqual(getCustomFoods(), [first])

  const second = createCustomFood({ ...input, name: 'Quark' })
  upsertCustomFood(second)
  assert.deepEqual(
    getCustomFoods().map((f) => f.id),
    [first.id, second.id],
  )

  const updatedFirst = applyCustomFoodInput(first, { ...input, name: 'Skyr Natur (aktualisiert)' })
  upsertCustomFood(updatedFirst)
  const stored = getCustomFoods()
  assert.equal(stored.length, 2)
  assert.equal(stored[0]?.name.de, 'Skyr Natur (aktualisiert)')
})

test('deleteCustomFood entfernt nur die passende Zutat', () => {
  saveCustomFoods([])
  const first = createCustomFood(input)
  const second = createCustomFood({ ...input, name: 'Quark' })
  saveCustomFoods([first, second])

  deleteCustomFood(first.id)

  assert.deepEqual(getCustomFoods(), [second])
})

test('parseStoredCustomFoods gibt leeres Array zurück, wenn nichts gespeichert oder JSON kaputt ist', () => {
  assert.deepEqual(parseStoredCustomFoods(null), [])
  assert.deepEqual(parseStoredCustomFoods('{nicht valides json'), [])
  assert.deepEqual(parseStoredCustomFoods(JSON.stringify({ not: 'an array' })), [])
})

test('parseStoredCustomFoods überspringt nur kaputte einzelne Einträge, nicht die ganze Liste', () => {
  const valid = createCustomFood(input)
  const raw = JSON.stringify([valid, { id: 'broken' }, 42, null])

  assert.deepEqual(parseStoredCustomFoods(raw), [valid])
})

test('isValidCustomFoodItem lehnt fehlende Pflichtfelder ab', () => {
  const valid = createCustomFood(input)
  assert.equal(isValidCustomFoodItem(valid), true)
  assert.equal(isValidCustomFoodItem({ ...valid, id: '' }), false)
  assert.equal(isValidCustomFoodItem({ ...valid, name: { de: '' } }), false)
  assert.equal(isValidCustomFoodItem({ ...valid, category: undefined }), false)
  assert.equal(isValidCustomFoodItem({ ...valid, energyKcal: 'viel' }), false)
  assert.equal(isValidCustomFoodItem(null), false)
  assert.equal(isValidCustomFoodItem('food'), false)
})
