import type { Gender, UserProfile } from './models/userProfile.ts'
import { NUTRIENT_LABELS } from '../utils/nutrientLabels.ts'

const STORAGE_KEYS = {
  userProfile: 'nutribalance:userProfile',
  requirementOverrides: 'nutribalance:requirementOverrides',
  historySettings: 'nutribalance:historySettings',
} as const

/** Manuelle Anpassungen einzelner Bedarfswerte, nach Nährstoff-ID (siehe requirementService.ts). */
export type RequirementOverrides = Record<string, number>

function isValidGender(value: unknown): value is Gender {
  return value === 'male' || value === 'female'
}

export function isValidUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.age === 'number' &&
    Number.isFinite(candidate.age) &&
    isValidGender(candidate.gender) &&
    typeof candidate.heightCm === 'number' &&
    Number.isFinite(candidate.heightCm)
  )
}

/**
 * Reine Parsing-Logik, getrennt von `localStorage.getItem`, damit sie ohne
 * echtes `localStorage` (z.B. in Node-Unit-Tests) getestet werden kann.
 * Beschädigte/fremde Daten (kaputtes JSON, falsche Feldtypen, manuell
 * editiert) führen zu `null` statt einem Fehler — der Aufrufer zeigt dann
 * einfach wieder das Formular an.
 */
export function parseStoredProfile(raw: string | null): UserProfile | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isValidUserProfile(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function getUserProfile(): UserProfile | null {
  return parseStoredProfile(localStorage.getItem(STORAGE_KEYS.userProfile))
}

export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(profile))
}

export function clearUserProfile(): void {
  localStorage.removeItem(STORAGE_KEYS.userProfile)
}

export function isValidRequirementOverrides(value: unknown): value is RequirementOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).every(
    (v) => typeof v === 'number' && Number.isFinite(v),
  )
}

/**
 * Reine Parsing-Logik, analog zu `parseStoredProfile`: beschädigte/fremde
 * Daten führen zu einem leeren Objekt (= keine Anpassungen) statt einem Fehler.
 */
export function parseStoredRequirementOverrides(raw: string | null): RequirementOverrides {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return isValidRequirementOverrides(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function getRequirementOverrides(): RequirementOverrides {
  return parseStoredRequirementOverrides(localStorage.getItem(STORAGE_KEYS.requirementOverrides))
}

export function saveRequirementOverrides(overrides: RequirementOverrides): void {
  localStorage.setItem(STORAGE_KEYS.requirementOverrides, JSON.stringify(overrides))
}

/** Einstellungen der Verlauf-Seite (Instruktion 11), persistent pro Gerät. */
export interface HistorySettings {
  /** Welche Nährstoffe im Chart dargestellt werden (mind. einer). */
  nutrientIds: string[]
  /** Zeitraum: `'week'` = 7 Tage, `'month'` = 30 Tage, jeweils bis heute. */
  period: 'week' | 'month'
}

export const DEFAULT_HISTORY_SETTINGS: HistorySettings = {
  nutrientIds: ['protein'],
  period: 'week',
}

/**
 * Reine Parsing-Logik, analog zu `parseStoredProfile`: beschädigte/fremde
 * Daten führen zum Default statt zu einem Fehler. Unbekannte Nährstoff-IDs
 * (nicht in `NUTRIENT_LABELS`) werden herausgefiltert; bleibt danach nichts
 * übrig, greift der Default.
 */
export function parseStoredHistorySettings(raw: string | null): HistorySettings {
  if (!raw) return { ...DEFAULT_HISTORY_SETTINGS }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_HISTORY_SETTINGS }
    }
    const candidate = parsed as Record<string, unknown>

    const nutrientIds = Array.isArray(candidate.nutrientIds)
      ? candidate.nutrientIds.filter(
          (id): id is string => typeof id === 'string' && id in NUTRIENT_LABELS,
        )
      : []

    return {
      nutrientIds:
        nutrientIds.length > 0 ? nutrientIds : [...DEFAULT_HISTORY_SETTINGS.nutrientIds],
      period:
        candidate.period === 'week' || candidate.period === 'month'
          ? candidate.period
          : DEFAULT_HISTORY_SETTINGS.period,
    }
  } catch {
    return { ...DEFAULT_HISTORY_SETTINGS }
  }
}

export function getHistorySettings(): HistorySettings {
  return parseStoredHistorySettings(localStorage.getItem(STORAGE_KEYS.historySettings))
}

export function saveHistorySettings(settings: HistorySettings): void {
  localStorage.setItem(STORAGE_KEYS.historySettings, JSON.stringify(settings))
}
