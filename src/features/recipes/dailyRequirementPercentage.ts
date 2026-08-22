import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import type { NutrientValues } from './models/nutritionValues.ts'

/** Physiologischer Brennwert, um einen %-der-Energie-Referenzwert in Gramm umzurechnen. */
const KCAL_PER_GRAM: Record<string, number> = {
  fat: 9,
  carbohydrates: 4,
}

function targetValue(requirement: NutrientRequirement): number | undefined {
  return requirement.recommended ?? requirement.min ?? requirement.max
}

/**
 * Rechnet einen Referenzwert in dieselbe Einheit um wie die berechnete
 * Aufnahme (die immer in Gramm/kcal vorliegt, siehe `nutritionCalculator.ts`).
 * - Einheiten stimmen bereits überein (z.B. Energie, Protein, Ballaststoffe
 *   ab 19 Jahren) → Referenzwert direkt übernehmen.
 * - `%energy` (Fett, Kohlenhydrate): über den Energiebedarf in Gramm
 *   umgerechnet (z.B. 30% von 2100kcal Fett ÷ 9 kcal/g).
 * - `g/1000kcal` (Ballaststoffe, 15–19 Jahre): hier bewusst NICHT unterstützt
 *   — die Aufnahme ist in Gramm, der Referenzwert in Gramm pro 1000kcal
 *   Gesamtenergie; eine korrekte Umrechnung bräuchte die Tagesenergiezufuhr
 *   der ganzen Ernährung, nicht nur dieses einen Rezepts. Bleibt offen für
 *   eine spätere Instruktion mit echtem Tagesprotokoll.
 */
function targetInSameUnit(
  requirement: NutrientRequirement,
  amountUnit: string,
  energyRequirementKcal: number | undefined,
): number | null {
  const target = targetValue(requirement)
  if (target === undefined) return null

  if (requirement.unit === amountUnit) return target

  if (requirement.unit === '%energy' && amountUnit === 'g') {
    const kcalPerGram = KCAL_PER_GRAM[requirement.nutrientId]
    if (!kcalPerGram || energyRequirementKcal === undefined) return null
    return ((target / 100) * energyRequirementKcal) / kcalPerGram
  }

  return null
}

/**
 * Berechnet für jeden Nährstoff in `perServing`, wie viel Prozent des
 * Tagesbedarfs eine Portion deckt. `null` bedeutet: kein Vergleich möglich
 * (keine Referenzwerte für die Altersgruppe, oder inkompatible Einheit —
 * siehe `targetInSameUnit`), nicht "0%".
 */
export function calculateDailyRequirementPercentage(
  perServing: NutrientValues,
  requirements: NutrientRequirement[],
): Map<string, number | null> {
  const requirementsById = new Map(requirements.map((r) => [r.nutrientId, r]))
  const energyRequirement = requirementsById.get('energy')
  const energyTargetKcal = energyRequirement ? targetValue(energyRequirement) : undefined

  const result = new Map<string, number | null>()
  for (const amount of perServing) {
    const requirement = requirementsById.get(amount.nutrientId)
    if (!requirement) {
      result.set(amount.nutrientId, null)
      continue
    }
    const target = targetInSameUnit(requirement, amount.unit, energyTargetKcal)
    result.set(amount.nutrientId, target ? (amount.value / target) * 100 : null)
  }
  return result
}
