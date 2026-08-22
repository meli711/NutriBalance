import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deleteMenu, getAllMenus, getMenuById, saveMenu } from './indexedDbService.ts'
import type { Menu } from '../features/menu-builder/models/menu.ts'

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
