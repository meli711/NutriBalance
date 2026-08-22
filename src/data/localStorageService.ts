export interface UserProfile {
  age: number
  heightCm: number
  gender: 'male' | 'female' | 'other'
  selectedNutrients: string[]
}

const STORAGE_KEYS = {
  userProfile: 'nutribalance:userProfile',
} as const

export function getUserProfile(): UserProfile | null {
  const raw = localStorage.getItem(STORAGE_KEYS.userProfile)
  if (!raw) return null
  return JSON.parse(raw) as UserProfile
}

export function setUserProfile(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(profile))
}

export function clearUserProfile(): void {
  localStorage.removeItem(STORAGE_KEYS.userProfile)
}
