import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportBackup, importBackup, parseBackupJson, validateBackupData } from './backupService.ts'
import {
  getRequirementOverrides,
  getUserProfile,
  saveRequirementOverrides,
  saveUserProfile,
} from '../../data/localStorageService.ts'
import {
  addLogEntry,
  getAllLogEntries,
  getAllMenus,
  saveMenu,
} from '../../data/indexedDbService.ts'
import { createCustomFood, getCustomFoods, saveCustomFoods } from '../../data/customFoodService.ts'
import { BACKUP_SCHEMA_VERSION } from './models/backup.ts'
import type { Menu } from '../menu-builder/models/menu.ts'
import type { LogEntry } from '../daily-log/models/logEntry.ts'
import { readFileSync } from 'node:fs'
import { calculateNutrition } from '../recipes/nutritionCalculator.ts'

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
  factor: 1,
}
const customFood = createCustomFood({
  name: 'Skyr Natur',
  category: '',
  energyKcal: 63,
  protein: 11,
  fat: 0.2,
  saturatedFat: 0.1,
  carbohydrates: 4,
  sugar: 4,
  fiber: 0,
  novaGroup: 2,
})

test('Export -> Import (Round-Trip) ergibt identischen Datenzustand', async () => {
  const overrides = { energy: 2000 }
  saveUserProfile(profile)
  saveRequirementOverrides(overrides)
  await saveMenu(menu)
  await addLogEntry(logEntry)
  saveCustomFoods([customFood])

  const exported = await exportBackup()

  // Zustand danach verändern, um sicherzustellen, dass der Import wirklich wiederherstellt.
  saveUserProfile({ age: 99, gender: 'male', heightCm: 200 })
  saveRequirementOverrides({ energy: 2700 })
  await saveMenu({ ...menu, id: 'other-menu' })
  saveCustomFoods([])

  await importBackup(exported)

  assert.deepEqual(getUserProfile(), profile)
  assert.deepEqual(getRequirementOverrides(), overrides)
  assert.deepEqual(await getAllMenus(), [menu])
  assert.deepEqual(await getAllLogEntries(), [logEntry])
  assert.deepEqual(getCustomFoods(), [customFood])
})

test('importBackup lehnt falsche schemaVersion ab, ohne bestehende Daten zu verändern', async () => {
  saveUserProfile(profile)
  await importBackup({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(0).toISOString(),
    profile,
    requirementOverrides: { energy: 2000 },
    menus: [menu],
    logEntries: [logEntry],
    customFoods: [customFood],
  })
  const before = {
    profile: getUserProfile(),
    requirementOverrides: getRequirementOverrides(),
    menus: await getAllMenus(),
    logEntries: await getAllLogEntries(),
    customFoods: getCustomFoods(),
  }

  await assert.rejects(() =>
    importBackup({
      schemaVersion: BACKUP_SCHEMA_VERSION + 1,
      exportedAt: new Date(0).toISOString(),
      profile: { age: 1, gender: 'male', heightCm: 100 },
      requirementOverrides: { energy: 2700 },
      menus: [],
      logEntries: [],
      customFoods: [],
    }),
  )

  assert.deepEqual(getUserProfile(), before.profile)
  assert.deepEqual(getRequirementOverrides(), before.requirementOverrides)
  assert.deepEqual(await getAllMenus(), before.menus)
  assert.deepEqual(await getAllLogEntries(), before.logEntries)
  assert.deepEqual(getCustomFoods(), before.customFoods)
})

test('validateBackupData lehnt ein v1-Backup (ohne customFoods) ab, statt es zu migrieren', () => {
  const result = validateBackupData({
    schemaVersion: 1,
    exportedAt: new Date(0).toISOString(),
    profile: null,
    requirementOverrides: {},
    menus: [],
    logEntries: [],
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /App-Version/)
})

test('validateBackupData akzeptiert Log-Einträge ohne `factor` (Backup von vor Instruktion 15)', () => {
  const entryWithoutFactor: Record<string, unknown> = { ...logEntry }
  delete entryWithoutFactor.factor
  const result = validateBackupData({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(0).toISOString(),
    profile: null,
    requirementOverrides: {},
    menus: [],
    logEntries: [entryWithoutFactor],
    customFoods: [],
  })
  assert.equal(result.ok, true)
})

test('validateBackupData lehnt Log-Einträge mit ungültigem `factor` ab', () => {
  const result = validateBackupData({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(0).toISOString(),
    profile: null,
    requirementOverrides: {},
    menus: [],
    logEntries: [{ ...logEntry, factor: 'zwei' }],
    customFoods: [],
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /Log-Einträge/)
})

test('validateBackupData akzeptiert customFoods ohne novaGroup (Backup von vor Instruktion 17)', () => {
  const foodWithoutNova = { ...customFood } as Record<string, unknown>
  delete foodWithoutNova.novaGroup
  const result = validateBackupData({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(0).toISOString(),
    profile: null,
    requirementOverrides: {},
    menus: [],
    logEntries: [],
    customFoods: [foodWithoutNova],
  })
  assert.equal(result.ok, true)
})

test('validateBackupData lehnt ungültige customFoods ab', () => {
  const result = validateBackupData({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(0).toISOString(),
    profile: null,
    requirementOverrides: {},
    menus: [],
    logEntries: [],
    customFoods: [{ id: 'broken' }],
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /eigene Zutaten/)
})

test('validateBackupData lehnt fehlende/falsche schemaVersion mit klarer Fehlermeldung ab', () => {
  const result = validateBackupData({
    exportedAt: new Date(0).toISOString(),
    profile: null,
    requirementOverrides: {},
    menus: [],
    logEntries: [],
    customFoods: [],
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /App-Version/)
})

test('validateBackupData lehnt ungültige requirementOverrides ab', () => {
  const result = validateBackupData({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(0).toISOString(),
    profile: null,
    requirementOverrides: { energy: 'viel' },
    menus: [],
    logEntries: [],
    customFoods: [],
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /Bedarfs-Anpassungen/)
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
    requirementOverrides: { energy: 2000 },
    menus: [menu],
    logEntries: [logEntry],
    customFoods: [customFood],
  })
  const result = parseBackupJson(raw)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.deepEqual(result.data.requirementOverrides, { energy: 2000 })
    assert.deepEqual(result.data.menus, [menu])
    assert.deepEqual(result.data.logEntries, [logEntry])
    assert.deepEqual(result.data.customFoods, [customFood])
  }
})

// --- Abwärtskompatibilität Vitamin B12/Folat (Instruktion 23) ---

/**
 * Backup im Format von vor Instruktion 23 (schemaVersion 2, Overrides ohne
 * B12/Folat, eigene Zutat mit `b12Cobalamin`/`folate` = null). Bewusst als
 * fixe Datei statt über `createCustomFood` erzeugt, damit sich das Fixture
 * nicht still mit dem Code mitverändert.
 */
const LEGACY_BACKUP_RAW = readFileSync(
  new URL('./fixtures/backup-v2-vor-b12-folat.json', import.meta.url),
  'utf-8',
)

test('Backup im Format vor B12/Folat bleibt importierbar und unverändert', async () => {
  const parsed = parseBackupJson(LEGACY_BACKUP_RAW)
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error)
  const expected = JSON.parse(LEGACY_BACKUP_RAW)

  await importBackup(parsed.data)

  assert.deepEqual(getUserProfile(), expected.profile)
  assert.deepEqual(getRequirementOverrides(), expected.requirementOverrides)
  assert.deepEqual(await getAllMenus(), expected.menus)
  assert.deepEqual(await getAllLogEntries(), expected.logEntries)
  assert.deepEqual(getCustomFoods(), expected.customFoods)

  // Importierte eigene Zutat ohne B12-/Folat-Wert → "kein Wert" (Stern), kein Fehler.
  const [food] = getCustomFoods()
  const values = calculateNutrition(
    [{ foodId: food.id, amountGrams: 150 }],
    new Map([[food.id, food]]),
  )
  assert.equal(values.find((v) => v.nutrientId === 'vitaminB12')?.incomplete, true)
  assert.equal(values.find((v) => v.nutrientId === 'folate')?.incomplete, true)

  // Instruktion 24: gesättigte Fettsäuren sind im Fixture vorhanden, die
  // ungesättigten nicht → Stern, kein Fehler.
  const saturated = values.find((v) => v.nutrientId === 'saturatedFat')
  assert.equal(saturated?.incomplete, false)
  assert.equal(Math.round(saturated!.value * 100) / 100, 0.15) // 0.1 g/100 g × 150 g
  assert.equal(values.find((v) => v.nutrientId === 'monounsaturatedFat')?.incomplete, true)
  assert.equal(values.find((v) => v.nutrientId === 'polyunsaturatedFat')?.incomplete, true)
})

test('Override für folate übersteht den Export -> Import (Round-Trip)', async () => {
  const overrides = { energy: 2000, folate: 400, vitaminB12: 5 }
  saveUserProfile(profile)
  saveRequirementOverrides(overrides)

  const exported = await exportBackup()
  saveRequirementOverrides({})

  const reparsed = parseBackupJson(JSON.stringify(exported))
  assert.ok(reparsed.ok)
  await importBackup(reparsed.data)

  assert.deepEqual(getRequirementOverrides(), overrides)
})
