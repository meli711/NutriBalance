import type { UserProfile } from '../../../data/models/userProfile.ts'
import type { Menu } from '../../menu-builder/models/menu.ts'
import type { LogEntry } from '../../daily-log/models/logEntry.ts'
import type { RequirementOverrides } from '../../../data/localStorageService.ts'

/** Aktuelle Version des Backup-Dateiformats — bei künftigen Datenmodell-
 * Änderungen erhöhen, damit Import unbekannte Formate erkennt statt sie zu erraten.
 * (Vor dem ersten produktiven Einsatz um `requirementOverrides` ergänzt, ohne
 * die Version zu erhöhen — es gibt noch keine v1-Backups im Feld, die davon
 * betroffen wären.) */
export const BACKUP_SCHEMA_VERSION = 1

export interface BackupData {
  schemaVersion: number
  /** ISO-Timestamp, wann das Backup erstellt wurde. */
  exportedAt: string
  profile: UserProfile | null
  requirementOverrides: RequirementOverrides
  menus: Menu[]
  logEntries: LogEntry[]
}
