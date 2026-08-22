import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Menu } from '../features/menu-builder/models/menu.ts'

interface NutriBalanceDB extends DBSchema {
  menus: {
    key: string
    value: Menu
  }
}

const DB_NAME = 'nutribalance'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<NutriBalanceDB>> | null = null

function getDb(): Promise<IDBPDatabase<NutriBalanceDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NutriBalanceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('menus')) {
          db.createObjectStore('menus', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

export async function saveMenu(menu: Menu): Promise<void> {
  const db = await getDb()
  await db.put('menus', menu)
}

export async function getAllMenus(): Promise<Menu[]> {
  const db = await getDb()
  return db.getAll('menus')
}

export async function getMenuById(id: string): Promise<Menu | undefined> {
  const db = await getDb()
  return db.get('menus', id)
}

export async function deleteMenu(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('menus', id)
}
