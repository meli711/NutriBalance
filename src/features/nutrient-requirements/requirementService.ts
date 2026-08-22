import type { UserProfile } from '../../data/localStorageService.ts'
import { AGE_GROUPS, REFERENCE_VALUES } from './data/referenceValues.ts'
import type { AgeGroup, Gender, NutrientRequirement } from './models/requirement.ts'

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
 * Die D-A-CH-Referenzwerte unterscheiden nur männlich/weiblich. Für
 * `gender: 'other'` gibt es aktuell keine belegte DACH-Angabe — anstatt einen
 * Wert zu erfinden (z.B. per Mittelwertbildung), wirft die Funktion bewusst
 * einen Fehler. Wie damit umgegangen wird, ist eine offene Frage für die
 * schriftliche Arbeit, keine rein technische.
 */
function toDachGender(gender: UserProfile['gender']): Gender {
  if (gender === 'male' || gender === 'female') return gender
  throw new Error(
    `Für gender: 'other' liegen keine eigenen DACH-Referenzwerte vor (nur männlich/weiblich). ` +
      `Muss fachlich/redaktionell entschieden werden, bevor hier automatisch ein Wert gewählt wird.`,
  )
}

export function getRequirementsForProfile(profile: UserProfile): NutrientRequirement[] {
  const ageGroup = findAgeGroup(profile.age)
  const gender = toDachGender(profile.gender)

  return REFERENCE_VALUES.filter(
    (entry) => entry.ageGroupId === ageGroup.id && entry.gender === gender,
  )
}
