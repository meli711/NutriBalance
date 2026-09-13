import type { UserProfile } from '../../../data/models/userProfile.ts'
import type { FoodItem } from '../../../data/models/food.ts'
import type { Menu } from '../../menu-builder/models/menu.ts'
import type { LogEntry } from '../../daily-log/models/logEntry.ts'
import type { RequirementOverrides } from '../../../data/localStorageService.ts'

/** Aktuelle Version des Backup-Dateiformats — bei künftigen Datenmodell-
 * Änderungen erhöhen, damit Import unbekannte Formate erkennt statt sie zu erraten.
 * (Vor dem ersten produktiven Einsatz um `requirementOverrides` ergänzt, ohne
 * die Version zu erhöhen — es gab noch keine v1-Backups im Feld, die davon
 * betroffen wären. Mit Instruktion 13 (`customFoods`) auf 2 erhöht, da die
 * App inzwischen im Einsatz ist und bestehende v1-Backups sonst
 * stillschweigend ohne eigene Zutaten importiert würden — siehe
 * `validateBackupData`, das v1-Dateien bewusst ablehnt statt sie zu migrieren.) */
export const BACKUP_SCHEMA_VERSION = 2

export interface BackupData {
  schemaVersion: number
  /** ISO-Timestamp, wann das Backup erstellt wurde. */
  exportedAt: string
  profile: UserProfile | null
  requirementOverrides: RequirementOverrides
  menus: Menu[]
  logEntries: LogEntry[]
  /** Eigene, lokal erfasste Zutaten (Instruktion 13) — seit Version 2. */
  customFoods: FoodItem[]
}
