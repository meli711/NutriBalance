import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFoodDeleteConfirmMessage,
  buildMenuDeleteConfirmMessage,
  countFoodUsage,
  countMenuUsage,
} from './referenceUsageService.ts'
import { addLogEntry, saveMenu } from '../../data/indexedDbService.ts'
import type { Menu } from '../menu-builder/models/menu.ts'
import type { LogEntry } from '../daily-log/models/logEntry.ts'

function makeMenu(overrides: Partial<Menu> & { id: string }): Menu {
  return {
    name: 'Testmenü',
    description: '',
    createdAt: new Date(0).toISOString(),
    ingredients: [{ foodId: 'custom-local-usage-test', amountGrams: 50 }],
    ...overrides,
  }
}

test('countFoodUsage zählt Log-Einträge (type food) und Menüs mit dieser Zutat', async () => {
  const foodId = 'custom-local-usage-a'
  const logEntry: LogEntry = {
    id: 'usage-log-1',
    date: '2026-01-01',
    type: 'food',
    foodId,
    amountGrams: 100,
  }
  await addLogEntry(logEntry)
  await saveMenu(makeMenu({ id: 'usage-menu-1', ingredients: [{ foodId, amountGrams: 50 }] }))
  await saveMenu(makeMenu({ id: 'usage-menu-2', ingredients: [{ foodId: 'other-food', amountGrams: 50 }] }))

  const usage = await countFoodUsage(foodId)

  assert.equal(usage.logEntries, 1)
  assert.equal(usage.menus, 1)
})

test('countFoodUsage gibt 0/0 zurück für eine unbenutzte Zutat', async () => {
  const usage = await countFoodUsage('custom-local-never-used')
  assert.deepEqual(usage, { logEntries: 0, menus: 0 })
})

test('countMenuUsage zählt nur Log-Einträge vom Typ menu mit passender menuId', async () => {
  const menuId = 'usage-menu-logged'
  const menuEntry: LogEntry = { id: 'usage-log-menu-1', date: '2026-01-01', type: 'menu', menuId }
  const otherEntry: LogEntry = {
    id: 'usage-log-menu-2',
    date: '2026-01-02',
    type: 'menu',
    menuId: 'other-menu',
  }
  await addLogEntry(menuEntry)
  await addLogEntry(otherEntry)

  assert.equal(await countMenuUsage(menuId), 1)
  assert.equal(await countMenuUsage('never-logged-menu'), 0)
})

test('buildFoodDeleteConfirmMessage gibt die einfache Rückfrage zurück, wenn die Zutat nirgends verwendet wird', () => {
  const message = buildFoodDeleteConfirmMessage('Skyr Natur', { logEntries: 0, menus: 0 })
  assert.equal(message, '"Skyr Natur" wirklich löschen?')
})

test('buildFoodDeleteConfirmMessage warnt mit Zahlen und dem Hinweis "Nur löschen, wenn du weisst, was du machst!"', () => {
  const message = buildFoodDeleteConfirmMessage('Skyr Natur', { logEntries: 2, menus: 1 })
  assert.match(message, /2 Log-Einträgen/)
  assert.match(message, /1 Menü/)
  assert.match(message, /Nur löschen, wenn du weisst, was du machst!/)
})

test('buildMenuDeleteConfirmMessage gibt die einfache Rückfrage zurück, wenn das Menü nirgends geloggt ist', () => {
  assert.equal(buildMenuDeleteConfirmMessage('Frühstück', 0), '"Frühstück" wirklich löschen?')
})

test('buildMenuDeleteConfirmMessage warnt mit Anzahl Log-Einträgen und dem Hinweis', () => {
  const message = buildMenuDeleteConfirmMessage('Frühstück', 3)
  assert.match(message, /3 Log-Einträgen/)
  assert.match(message, /Nur löschen, wenn du weisst, was du machst!/)
})
