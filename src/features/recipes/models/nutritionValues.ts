/**
 * Berechnete Nährstoffmenge (Aufnahme), absichtlich strukturell parallel zu
 * `NutrientRequirement` (siehe `features/nutrient-requirements/models/requirement.ts`):
 * gleiches Feld `nutrientId` + `unit`, damit sich Bedarf und Aufnahme später
 * nebeneinander auswerten lassen. Für Details/Einschränkungen der
 * Kompatibilität siehe den Kommentar in `nutritionCalculator.ts`.
 */
export interface NutrientAmount {
  nutrientId: string
  unit: string
  value: number
  /**
   * `true`, wenn für mindestens eine Zutat kein Wert für diesen Nährstoff in
   * der Lebensmitteldatenbank vorlag (`null`, siehe Instruktion 2). `value`
   * ist dann eine Unterschätzung, nicht der tatsächliche Gehalt.
   */
  incomplete: boolean
}

export type NutrientValues = NutrientAmount[]
