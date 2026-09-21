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
// Instruktion 15 fügt `LogEntry.factor` hinzu, ohne die Version zu erhöhen:
// IndexedDB validiert gespeicherte Objekte nicht gegen ein Schema, ein neues
// optionales Feld erfordert keine upgrade()-Änderung. Alte, bereits
// gespeicherte Einträge ohne `factor` werden beim Lesen über
// `normalizeLogEntry` defensiv ergänzt (siehe unten). Instruktion 19
// entfernt `RecipeLogEntry.servings` wieder, ebenfalls ohne Versions-
// erhöhung: alte Einträge mit noch vorhandenem `servings` werden dort
// zusätzlich rückwärtskompatibel in `factor` gefaltet statt verworfen.
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

/**
 * Aktualisiert einen bestehenden Log-Eintrag (z.B. geänderter `factor`,
 * Instruktion 15). Funktional identisch zu `addLogEntry` — `db.put` ist
 * bereits ein Upsert über `keyPath: 'id'` — aber als eigener Name an den
 * Aufrufstellen klarer als "ändern" statt "neu hinzufügen".
 */
export const updateLogEntry = addLogEntry

export async function removeLogEntry(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('logEntries', id)
}

/**
 * Ergänzt `factor` defensiv auf `1`, falls der Eintrag vor Instruktion 15
 * gespeichert wurde und das Feld daher zur Laufzeit fehlt (auch wenn der Typ
 * es als Pflichtfeld deklariert). Zusätzlich faltet sie bei `recipe`-
 * Einträgen ein evtl. noch vorhandenes altes `servings`-Feld (vor
 * Instruktion 19, "Anzahl gegessener Portionen") multiplikativ in `factor`
 * (`factor_neu = factor_alt * servings_alt`), statt es einfach zu
 * ignorieren — sonst würde z.B. "0.5 Portionen, 2x" (Summe: 1) nach dem
 * Entfernen des Feldes als "2x die ganze Portion" gelesen und die
 * historische Tagessumme dieses bereits vergangenen Tages würde sich
 * rückwirkend ändern. Zentral an dieser Stelle, damit sich keine andere
 * Stelle im Code um alte Datensätze kümmern muss. Reine Lese-
 * Normalisierung (kein Zurückschreiben in den Store) — eine spätere
 * Bearbeitung des Eintrags (z.B. Faktor ändern im Tages-Log) persistiert
 * die gefaltete, `servings`-freie Form automatisch beim nächsten
 * `updateLogEntry`.
 */
function normalizeLogEntry(entry: LogEntry): LogEntry {
  // Cast, weil `factor` im Typ Pflicht ist und `servings` bei `recipe`
  // seit Instruktion 19 gar nicht mehr existiert — bei alten Datensätzen
  // können beide zur Laufzeit trotzdem vorkommen.
  const raw = entry as LogEntry & { factor?: number; servings?: number }
  const factor = raw.factor ?? 1

  if (raw.type === 'recipe' && raw.servings !== undefined) {
    const { servings, ...rest } = raw
    return { ...rest, factor: factor * servings }
  }

  return raw.factor === undefined ? { ...entry, factor: 1 } : entry
}

/** Nutzt den `by-date`-Index — lädt nur die Einträge des Tages, nicht den ganzen Store. */
export async function getLogEntriesForDate(date: string): Promise<LogEntry[]> {
  const db = await getDb()
  const entries = await db.getAllFromIndex('logEntries', 'by-date', date)
  return entries.map(normalizeLogEntry)
}

/** Alle Log-Einträge über alle Tage hinweg — für das Backup (Instruktion 10). */
export async function getAllLogEntries(): Promise<LogEntry[]> {
  const db = await getDb()
  const entries = await db.getAll('logEntries')
  return entries.map(normalizeLogEntry)
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
  const entries = await db.getAllFromIndex(
    'logEntries',
    'by-date',
    IDBKeyRange.bound(startDate, endDate),
  )
  return entries.map(normalizeLogEntry)
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
