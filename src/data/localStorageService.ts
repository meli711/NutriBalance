import type { Gender, UserProfile } from './models/userProfile.ts'

const STORAGE_KEYS = {
  userProfile: 'nutribalance:userProfile',
  requirementOverrides: 'nutribalance:requirementOverrides',
} as const

/** Manuelle Anpassungen einzelner Bedarfswerte, nach Nährstoff-ID (siehe requirementService.ts). */
export type RequirementOverrides = Record<string, number>

function isValidGender(value: unknown): value is Gender {
  return value === 'male' || value === 'female'
}

function isValidUserProfile(value: unknown): value is UserProfile {
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

function isValidRequirementOverrides(value: unknown): value is RequirementOverrides {
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
