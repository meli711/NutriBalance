import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Menu } from '../features/menu-builder/models/menu.ts'
import type { LogEntry } from '../features/daily-log/models/logEntry.ts'

interface NutriBalanceDB extends DBSchema {
  menus: {
    key: string
    value: Menu
  }
  logEntries: {
    key: string
    value: LogEntry
    indexes: { 'by-date': string }
  }
}

const DB_NAME = 'nutribalance'
// v2: neuer Object Store `logEntries` (Instruktion 9) — `menus` (v1) bleibt
// unverändert bestehen, siehe upgrade()-Migration unten.
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<NutriBalanceDB>> | null = null

function getDb(): Promise<IDBPDatabase<NutriBalanceDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NutriBalanceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('menus')) {
          db.createObjectStore('menus', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('logEntries')) {
          const store = db.createObjectStore('logEntries', { keyPath: 'id' })
          store.createIndex('by-date', 'date')
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

export async function addLogEntry(entry: LogEntry): Promise<void> {
  const db = await getDb()
  await db.put('logEntries', entry)
}

export async function removeLogEntry(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('logEntries', id)
}

/** Nutzt den `by-date`-Index — lädt nur die Einträge des Tages, nicht den ganzen Store. */
export async function getLogEntriesForDate(date: string): Promise<LogEntry[]> {
  const db = await getDb()
  return db.getAllFromIndex('logEntries', 'by-date', date)
}

/** Alle Log-Einträge über alle Tage hinweg — für das Backup (Instruktion 10). */
export async function getAllLogEntries(): Promise<LogEntry[]> {
  const db = await getDb()
  return db.getAll('logEntries')
}

/**
 * Alle Log-Einträge im Datumsbereich `startDate`..`endDate` (beide inklusive,
 * `YYYY-MM-DD`) — für die Wochen-/Monatsübersicht (Instruktion 11). Nutzt den
 * `by-date`-Index mit einer einzigen `IDBKeyRange.bound`-Abfrage, statt pro
 * Tag einzeln oder den ganzen Store zu laden.
 */
export async function getLogEntriesInRange(
  startDate: string,
  endDate: string,
): Promise<LogEntry[]> {
  const db = await getDb()
  return db.getAllFromIndex('logEntries', 'by-date', IDBKeyRange.bound(startDate, endDate))
}

/** Ersetzt den kompletten `menus`-Store atomar durch `menus` — für den Backup-Import. */
export async function replaceAllMenus(menus: Menu[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('menus', 'readwrite')
  await tx.store.clear()
  await Promise.all(menus.map((menu) => tx.store.put(menu)))
  await tx.done
}

/** Ersetzt den kompletten `logEntries`-Store atomar durch `entries` — für den Backup-Import. */
export async function replaceAllLogEntries(entries: LogEntry[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('logEntries', 'readwrite')
  await tx.store.clear()
  await Promise.all(entries.map((entry) => tx.store.put(entry)))
  await tx.done
}
