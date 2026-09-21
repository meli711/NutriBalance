import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addLogEntry,
  deleteMenu,
  getAllLogEntries,
  getAllMenus,
  getLogEntriesForDate,
  getMenuById,
  saveMenu,
} from './indexedDbService.ts'
import type { Menu } from '../features/menu-builder/models/menu.ts'
import type { LogEntry } from '../features/daily-log/models/logEntry.ts'

function makeMenu(overrides: Partial<Menu> & { id: string }): Menu {
  return {
    name: 'Testmenü',
    description: '',
    createdAt: new Date(0).toISOString(),
    ingredients: [{ foodId: '198', amountGrams: 50 }],
    ...overrides,
  }
}

test('saveMenu + getMenuById: Round-Trip liefert exakt das gespeicherte Menü', async () => {
  const menu = makeMenu({ id: 'round-trip-1', name: 'Frühstück', description: 'Hafer & Banane' })

  await saveMenu(menu)
  const loaded = await getMenuById('round-trip-1')

  assert.deepEqual(loaded, menu)
})

test('getAllMenus enthält alle gespeicherten Menüs', async () => {
  await saveMenu(makeMenu({ id: 'list-1', name: 'Menü A' }))
  await saveMenu(makeMenu({ id: 'list-2', name: 'Menü B' }))

  const all = await getAllMenus()
  const ids = all.map((m) => m.id)

  assert.ok(ids.includes('list-1'))
  assert.ok(ids.includes('list-2'))
})

test('getMenuById gibt undefined zurück für unbekannte id', async () => {
  const result = await getMenuById('does-not-exist')
  assert.equal(result, undefined)
})

test('deleteMenu entfernt ein Menü dauerhaft', async () => {
  const menu = makeMenu({ id: 'to-delete' })
  await saveMenu(menu)
  assert.ok(await getMenuById('to-delete'))

  await deleteMenu('to-delete')
  assert.equal(await getMenuById('to-delete'), undefined)
})

test('getLogEntriesForDate/getAllLogEntries ergänzen `factor: 1` bei Alt-Einträgen ohne dieses Feld (Instruktion 15)', async () => {
  // Simuliert einen vor Instruktion 15 gespeicherten Log-Eintrag: das Feld
  // `factor` fehlt zur Laufzeit, auch wenn der Typ es als Pflicht deklariert.
  const legacyEntry = {
    id: 'legacy-entry-1',
    date: '2026-01-01',
    type: 'food',
    foodId: '198',
    amountGrams: 100,
  } as unknown as LogEntry
  await addLogEntry(legacyEntry)

  const byDate = await getLogEntriesForDate('2026-01-01')
  const all = await getAllLogEntries()

  assert.equal(byDate.find((e) => e.id === 'legacy-entry-1')?.factor, 1)
  assert.equal(all.find((e) => e.id === 'legacy-entry-1')?.factor, 1)
})

test('getLogEntriesForDate/getAllLogEntries falten ein altes `servings`-Feld bei Rezept-Einträgen multiplikativ in `factor` (Instruktion 19)', async () => {
  // Simuliert einen vor Instruktion 19 gespeicherten Rezept-Eintrag: "0.5
  // Portionen, 2x an diesem Tag" (Summe: 1) — `servings` existiert im Typ
  // nicht mehr, kann zur Laufzeit aber noch im Store liegen.
  const legacyRecipeEntry = {
    id: 'legacy-recipe-1',
    date: '2026-01-02',
    type: 'recipe',
    recipeId: 'recipe-x',
    servings: 0.5,
    factor: 2,
  } as unknown as LogEntry
  await addLogEntry(legacyRecipeEntry)

  const byDate = await getLogEntriesForDate('2026-01-02')
  const all = await getAllLogEntries()

  const expectedFactor = 1 // 0.5 * 2
  const fromByDate = byDate.find((e) => e.id === 'legacy-recipe-1')
  const fromAll = all.find((e) => e.id === 'legacy-recipe-1')

  assert.equal(fromByDate?.factor, expectedFactor)
  assert.equal(fromAll?.factor, expectedFactor)
  assert.equal((fromByDate as unknown as { servings?: number })?.servings, undefined)
  assert.equal((fromAll as unknown as { servings?: number })?.servings, undefined)
})
