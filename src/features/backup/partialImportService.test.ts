import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  findMissingCustomFoodIds,
  mergeImportedItems,
  remapMenuIngredients,
  resolveReferencedCustomFoods,
} from './partialImportService.ts'
import { createCustomFood } from '../../data/customFoodService.ts'
import type { Menu } from '../menu-builder/models/menu.ts'

// `localStorage` gibt es unter Node (ohne DOM) standardmässig nicht —
// `createCustomFood`/`isOwnCustomFoodId` selbst brauchen es zwar nicht, aber
// `customFoodService.ts` importiert Module, die davon ausgehen, siehe die
// gleichartigen Shims in `backupService.test.ts`/`customFoodService.test.ts`.
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

function makeIdGenerator(prefix: string): () => string {
  let counter = 0
  return () => `${prefix}-${++counter}`
}

test('mergeImportedItems: keine Überschneidung — alle übernommen, idRemap leer', () => {
  const existing = [{ id: 'a', name: 'A' }]
  const incoming = [{ id: 'b', name: 'B' }]
  const result = mergeImportedItems(existing, incoming, makeIdGenerator('new'))

  assert.deepEqual(result.items, [existing[0], incoming[0]])
  assert.equal(result.idRemap.size, 0)
  assert.equal(result.importedCount, 1)
  assert.equal(result.skippedIdenticalCount, 0)
})

test('mergeImportedItems: gleiche ID + identischer Inhalt wird übersprungen', () => {
  const existing = [{ id: 'a', name: 'A' }]
  const incoming = [{ id: 'a', name: 'A' }]
  const result = mergeImportedItems(existing, incoming, makeIdGenerator('new'))

  assert.deepEqual(result.items, existing)
  assert.equal(result.idRemap.size, 0)
  assert.equal(result.importedCount, 0)
  assert.equal(result.skippedIdenticalCount, 1)
})

test('mergeImportedItems: gleiche ID + abweichender Inhalt bekommt neue ID, bestehender Eintrag bleibt unverändert', () => {
  const existing = [{ id: 'a', name: 'Alt' }]
  const incoming = [{ id: 'a', name: 'Neu (von anderer Person)' }]
  const result = mergeImportedItems(existing, incoming, makeIdGenerator('new'))

  assert.deepEqual(result.items[0], existing[0])
  assert.equal(result.items.length, 2)
  assert.deepEqual(result.items[1], { id: 'new-1', name: 'Neu (von anderer Person)' })
  assert.deepEqual([...result.idRemap.entries()], [['a', 'new-1']])
  assert.equal(result.importedCount, 1)
  assert.equal(result.skippedIdenticalCount, 0)
})

test('mergeImportedItems: zwei eingehende Einträge mit gleicher ID kollidieren auch untereinander', () => {
  const existing: { id: string; name: string }[] = []
  const incoming = [
    { id: 'x', name: 'Erste' },
    { id: 'x', name: 'Zweite' },
  ]
  const result = mergeImportedItems(existing, incoming, makeIdGenerator('new'))

  assert.equal(result.items.length, 2)
  assert.deepEqual(result.items[0], { id: 'x', name: 'Erste' })
  assert.deepEqual(result.items[1], { id: 'new-1', name: 'Zweite' })
  assert.deepEqual([...result.idRemap.entries()], [['x', 'new-1']])
})

test('mergeImportedItems: items.slice(existing.length) liefert genau die neu hinzugekommenen Einträge', () => {
  const existing = [{ id: 'a', name: 'A' }]
  const incoming = [
    { id: 'a', name: 'A' }, // identisch -> übersprungen
    { id: 'b', name: 'B' }, // neu
    { id: 'a', name: 'A-anders' }, // Kollision -> neue ID
  ]
  const result = mergeImportedItems(existing, incoming, makeIdGenerator('new'))

  const added = result.items.slice(existing.length)
  assert.deepEqual(added, [
    { id: 'b', name: 'B' },
    { id: 'new-1', name: 'A-anders' },
  ])
})

const genericFood = { foodId: '198', amountGrams: 50 }
const localCustomFood = createCustomFood({
  name: 'Lokal vorhanden',
  category: '',
  energyKcal: 10,
  protein: 1,
  fat: 1,
  saturatedFat: 0,
  carbohydrates: 1,
  sugar: 0,
  fiber: 0,
  novaGroup: null,
})
const missingCustomFoodId = 'custom-local-missing-123'
const menu: Menu = {
  id: 'menu-1',
  name: 'Testmenü',
  description: '',
  createdAt: new Date(0).toISOString(),
  ingredients: [
    genericFood,
    { foodId: localCustomFood.id, amountGrams: 20 },
    { foodId: missingCustomFoodId, amountGrams: 30 },
  ],
}

test('findMissingCustomFoodIds: nur fehlende eigene Zutaten, generische IDs werden ignoriert', () => {
  const missing = findMissingCustomFoodIds(menu, [localCustomFood])
  assert.deepEqual(missing, [missingCustomFoodId])
})

test('resolveReferencedCustomFoods: in der Backup-Datei auflösbare fehlende Zutat landet in foods', () => {
  const backupFood = { ...localCustomFood, id: missingCustomFoodId, name: { de: 'Aus dem Backup' } }
  const result = resolveReferencedCustomFoods([menu], [backupFood], [localCustomFood])

  assert.deepEqual(result.foods, [backupFood])
  assert.deepEqual(result.unresolvedIds, [])
})

test('resolveReferencedCustomFoods: weder lokal noch im Backup vorhandene ID landet in unresolvedIds', () => {
  const result = resolveReferencedCustomFoods([menu], [], [localCustomFood])

  assert.deepEqual(result.foods, [])
  assert.deepEqual(result.unresolvedIds, [missingCustomFoodId])
})

test('resolveReferencedCustomFoods: dieselbe fehlende ID über zwei Menüs wird nur einmal aufgelöst', () => {
  const otherMenu: Menu = { ...menu, id: 'menu-2' }
  const backupFood = { ...localCustomFood, id: missingCustomFoodId, name: { de: 'Aus dem Backup' } }
  const result = resolveReferencedCustomFoods([menu, otherMenu], [backupFood], [localCustomFood])

  assert.equal(result.foods.length, 1)
  assert.deepEqual(result.foods[0], backupFood)
})

test('remapMenuIngredients: nur betroffene Zutaten ändern sich, Original bleibt unverändert', () => {
  const idRemap = new Map([[missingCustomFoodId, 'custom-local-new-id']])
  const remapped = remapMenuIngredients(menu, idRemap)

  assert.deepEqual(remapped.ingredients, [
    genericFood,
    { foodId: localCustomFood.id, amountGrams: 20 },
    { foodId: 'custom-local-new-id', amountGrams: 30 },
  ])
  // Original unverändert (keine Mutation):
  assert.equal(menu.ingredients[2].foodId, missingCustomFoodId)
})

test('remapMenuIngredients: leeres idRemap gibt dasselbe Objekt zurück', () => {
  assert.equal(remapMenuIngredients(menu, new Map()), menu)
})
