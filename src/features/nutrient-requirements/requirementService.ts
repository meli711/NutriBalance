import type { UserProfile } from '../../data/models/userProfile.ts'
import { AGE_GROUPS, REFERENCE_VALUES } from './data/referenceValues.ts'
import type { AgeGroup, NutrientRequirement } from './models/requirement.ts'

export function findAgeGroup(age: number): AgeGroup {
  const group = AGE_GROUPS.find((g) => age >= g.minAge && (g.maxAge === null || age < g.maxAge))
  if (!group) {
    throw new Error(
      `Keine DACH-Altersgruppe für Alter ${age} hinterlegt (abgedeckt: ${AGE_GROUPS[0]?.minAge}+ Jahre).`,
    )
  }
  return group
}

export function getRequirementsForProfile(profile: UserProfile): NutrientRequirement[] {
  const ageGroup = findAgeGroup(profile.age)

  return REFERENCE_VALUES.filter(
    (entry) => entry.ageGroupId === ageGroup.id && entry.gender === profile.gender,
  )
}
