import type { UserProfile } from '../../data/models/userProfile.ts'
import type { RequirementOverrides } from '../../data/localStorageService.ts'
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

/**
 * Berechnet den DACH-Bedarf für ein Profil und wendet danach manuelle
 * Anpassungen an (siehe `profileView.ts` — z.B. weniger Kalorien oder mehr
 * Protein als der berechnete Wert). Nur Nährstoffe mit einem festen
 * `recommended`-Wert lassen sich anpassen; reine Richtwert-Bereiche
 * (z.B. "≥ 30g Ballaststoffe") bleiben unverändert.
 */
export function getRequirementsForProfile(
  profile: UserProfile,
  overrides: RequirementOverrides = {},
): NutrientRequirement[] {
  const ageGroup = findAgeGroup(profile.age)

  const base = REFERENCE_VALUES.filter(
    (entry) => entry.ageGroupId === ageGroup.id && entry.gender === profile.gender,
  )

  return base.map((entry) => {
    const overriddenValue = overrides[entry.nutrientId]
    if (overriddenValue === undefined || entry.recommended === undefined) return entry
    return { ...entry, recommended: overriddenValue, isOverridden: true }
  })
}
