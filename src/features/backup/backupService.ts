import {
  clearUserProfile,
  getRequirementOverrides,
  getUserProfile,
  isValidRequirementOverrides,
  isValidUserProfile,
  saveRequirementOverrides,
  saveUserProfile,
} from '../../data/localStorageService.ts'
import {
  getAllLogEntries,
  getAllMenus,
  replaceAllLogEntries,
  replaceAllMenus,
} from '../../data/indexedDbService.ts'
import {
  getCustomFoods,
  isValidCustomFoodItem,
  saveCustomFoods,
} from '../../data/customFoodService.ts'
import type { UserProfile } from '../../data/models/userProfile.ts'
import type { FoodItem } from '../../data/models/food.ts'
import type { Menu } from '../menu-builder/models/menu.ts'
import type { LogEntry } from '../daily-log/models/logEntry.ts'
import { BACKUP_SCHEMA_VERSION } from './models/backup.ts'
import type { BackupData } from './models/backup.ts'

export type BackupValidationResult = { ok: true; data: BackupData } | { ok: false; error: string }

function isValidMenu(value: unknown): value is Menu {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.description === 'string' &&
    typeof v.createdAt === 'string' &&
    Array.isArray(v.ingredients)
  )
}

function isValidLogEntry(value: unknown): value is LogEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.date !== 'string') return false

  switch (v.type) {
    case 'food':
      return typeof v.foodId === 'string' && typeof v.amountGrams === 'number'
    case 'recipe':
      return typeof v.recipeId === 'string' && typeof v.servings === 'number'
    case 'menu':
      return typeof v.menuId === 'string'
    default:
      return false
  }
}

/**
 * Reine Struktur-/Versionsprüfung, getrennt vom JSON-Parsing (siehe
 * `parseBackupJson`) und von jedem Storage-Zugriff, damit sie ohne
 * Browser-Umgebung getestet werden kann. Bei unbekannter `schemaVersion`
 * wird bewusst **nicht** versucht, das Format zu erraten.
 */
export function validateBackupData(value: unknown): BackupValidationResult {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'Die Datei enthält kein gültiges Backup-Format.' }
  }
  const v = value as Record<string, unknown>

  if (v.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error:
        'Diese Backup-Datei ist mit einer anderen App-Version erstellt worden und kann nicht importiert werden.',
    }
  }
  if (typeof v.exportedAt !== 'string') {
    return { ok: false, error: 'Die Backup-Datei enthält kein gültiges Erstellungsdatum.' }
  }
  if (v.profile !== null && !isValidUserProfile(v.profile)) {
    return { ok: false, error: 'Die Backup-Datei enthält ein ungültiges Profil.' }
  }
  if (!isValidRequirementOverrides(v.requirementOverrides)) {
    return { ok: false, error: 'Die Backup-Datei enthält ungültige Bedarfs-Anpassungen.' }
  }
  if (!Array.isArray(v.menus) || !v.menus.every(isValidMenu)) {
    return { ok: false, error: 'Die Backup-Datei enthält ungültige Menü-Daten.' }
  }
  if (!Array.isArray(v.logEntries) || !v.logEntries.every(isValidLogEntry)) {
    return { ok: false, error: 'Die Backup-Datei enthält ungültige Log-Einträge.' }
  }
  if (!Array.isArray(v.customFoods) || !v.customFoods.every(isValidCustomFoodItem)) {
    return { ok: false, error: 'Die Backup-Datei enthält ungültige eigene Zutaten.' }
  }

  return {
    ok: true,
    data: {
      schemaVersion: v.schemaVersion,
      exportedAt: v.exportedAt,
      profile: v.profile as UserProfile | null,
      requirementOverrides: v.requirementOverrides,
      menus: v.menus,
      logEntries: v.logEntries,
      customFoods: v.customFoods as FoodItem[],
    },
  }
}

/** JSON parsen + validieren in einem Schritt — kaputtes JSON führt zu einer klaren Fehlermeldung statt einem Absturz. */
export function parseBackupJson(raw: string): BackupValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON und konnte nicht gelesen werden.' }
  }
  return validateBackupData(parsed)
}

export async function exportBackup(): Promise<BackupData> {
  const [menus, logEntries] = await Promise.all([getAllMenus(), getAllLogEntries()])
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: getUserProfile(),
    requirementOverrides: getRequirementOverrides(),
    menus,
    logEntries,
    customFoods: getCustomFoods(),
  }
}

function backupFileName(date: Date): string {
  const iso = date.toISOString().slice(0, 10)
  return `nutribalance-backup-${iso}.json`
}

export async function downloadBackup(): Promise<void> {
  const data = await exportBackup()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = backupFileName(new Date())
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Ersetzt vollständig (kein Merge): Profil überschreiben, bestehende Menüs
 * und Log-Einträge löschen und durch die importierten ersetzen. Die
 * `schemaVersion` wird hier nochmals geprüft (nicht nur in der UI über
 * `parseBackupJson`), damit `importBackup` auch eigenständig sicher ist —
 * bei Ablehnung wird noch **nichts** an den bestehenden Daten verändert.
 */
export async function importBackup(data: BackupData): Promise<void> {
  if (data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(
      'Diese Backup-Datei ist mit einer anderen App-Version erstellt worden und kann nicht importiert werden.',
    )
  }

  if (data.profile) saveUserProfile(data.profile)
  else clearUserProfile()
  saveRequirementOverrides(data.requirementOverrides)
  saveCustomFoods(data.customFoods)

  await replaceAllMenus(data.menus)
  await replaceAllLogEntries(data.logEntries)
}
