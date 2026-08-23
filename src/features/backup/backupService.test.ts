import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportBackup, importBackup, parseBackupJson, validateBackupData } from './backupService.ts'
import { getUserProfile, saveUserProfile } from '../../data/localStorageService.ts'
import { addLogEntry, getAllLogEntries, getAllMenus, saveMenu } from '../../data/indexedDbService.ts'
import { BACKUP_SCHEMA_VERSION } from './models/backup.ts'
import type { Menu } from '../menu-builder/models/menu.ts'
import type { LogEntry } from '../daily-log/models/logEntry.ts'

// `localStorage` gibt es unter Node (ohne DOM) standardmässig nicht — für die
// getUserProfile/saveUserProfile-Aufrufe in backupService reicht ein
// minimaler In-Memory-Shim, analog zum `fake-indexeddb/auto`-Import oben.
// Wird erst zur Laufzeit (in Funktionsrümpfen) gelesen, daher reicht es, ihn
// vor dem ersten Test zu setzen.
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

const profile = { age: 30, gender: 'female' as const, heightCm: 170 }
const menu: Menu = {
  id: 'backup-menu-1',
  name: 'Testmenü',
  description: '',
  createdAt: new Date(0).toISOString(),
  ingredients: [{ foodId: '198', amountGrams: 50 }],
}
const logEntry: LogEntry = {
  id: 'backup-log-1',
  date: '2026-01-01',
  type: 'food',
  foodId: '198',
  amountGrams: 100,
}

test('Export -> Import (Round-Trip) ergibt identischen Datenzustand', async () => {
  saveUserProfile(profile)
  await saveMenu(menu)
  await addLogEntry(logEntry)

  const exported = await exportBackup()

  // Zustand danach verändern, um sicherzustellen, dass der Import wirklich wiederherstellt.
  saveUserProfile({ age: 99, gender: 'male', heightCm: 200 })
  await saveMenu({ ...menu, id: 'other-menu' })

  await importBackup(exported)

  assert.deepEqual(getUserProfile(), profile)
  assert.deepEqual(await getAllMenus(), [menu])
  assert.deepEqual(await getAllLogEntries(), [logEntry])
})

test('importBackup lehnt falsche schemaVersion ab, ohne bestehende Daten zu verändern', async () => {
  saveUserProfile(profile)
  await importBackup({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(0).toISOString(),
    profile,
    menus: [menu],
    logEntries: [logEntry],
  })
  const before = {
    profile: getUserProfile(),
    menus: await getAllMenus(),
    logEntries: await getAllLogEntries(),
  }

  await assert.rejects(() =>
    importBackup({
      schemaVersion: BACKUP_SCHEMA_VERSION + 1,
      exportedAt: new Date(0).toISOString(),
      profile: { age: 1, gender: 'male', heightCm: 100 },
      menus: [],
      logEntries: [],
    }),
  )

  assert.deepEqual(getUserProfile(), before.profile)
  assert.deepEqual(await getAllMenus(), before.menus)
  assert.deepEqual(await getAllLogEntries(), before.logEntries)
})

test('validateBackupData lehnt fehlende/falsche schemaVersion mit klarer Fehlermeldung ab', () => {
  const result = validateBackupData({
    exportedAt: new Date(0).toISOString(),
    profile: null,
    menus: [],
    logEntries: [],
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /App-Version/)
})

test('parseBackupJson fängt kaputtes JSON ab, statt abzustürzen', () => {
  const result = parseBackupJson('{nicht valides json')
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /JSON/)
})

test('parseBackupJson akzeptiert ein valides Backup', () => {
  const raw = JSON.stringify({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(0).toISOString(),
    profile: null,
    menus: [menu],
    logEntries: [logEntry],
  })
  const result = parseBackupJson(raw)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.deepEqual(result.data.menus, [menu])
    assert.deepEqual(result.data.logEntries, [logEntry])
  }
})
