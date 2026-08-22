import type { AgeGroup, Gender, NutrientRequirement } from '../models/requirement.ts'

/**
 * D-A-CH-Referenzwerte für die Nährstoffzufuhr (Deutschland/Österreich/Schweiz),
 * Quelle: Deutsche Gesellschaft für Ernährung (DGE), https://www.dge.de/wissenschaft/referenzwerte/
 * (dieselben Werte werden von der SGE für die Schweiz übernommen, sge-ssn.ch).
 * Abgerufen am 22.08.2026, jeweils die aktuell auf dge.de veröffentlichten Tabellen
 * (3. Auflage 2025). Für jede Nährstoffgruppe steht die genaue Unterseite als
 * `source` bei den einzelnen Werten.
 *
 * Abgedeckt sind bewusst nur die Makronährstoffe (Energie, Protein, Fett,
 * Kohlenhydrate, Ballaststoffe) für 5 Altersgruppen je Geschlecht — das sind
 * die realen DACH-Altersklassen (nicht künstlich zusammengefasst), da sich
 * z.B. Energie- und Proteinbedarf zwischen 51–65 und 65+ deutlich unterscheiden.
 * Mikronährstoffe (Vitamine, Mineralstoffe) sind noch nicht erfasst — das
 * `NutrientRequirement`-Modell ist dafür bereits vorbereitet (siehe
 * `models/requirement.ts`), die Werte müssten aber pro Nährstoff einzeln aus
 * den jeweiligen DGE-Unterseiten nachgetragen werden.
 */

export const AGE_GROUPS: AgeGroup[] = [
  { id: '15-19', label: '15 bis unter 19 Jahre', minAge: 15, maxAge: 19 },
  { id: '19-25', label: '19 bis unter 25 Jahre', minAge: 19, maxAge: 25 },
  { id: '25-51', label: '25 bis unter 51 Jahre', minAge: 25, maxAge: 51 },
  { id: '51-65', label: '51 bis unter 65 Jahre', minAge: 51, maxAge: 65 },
  { id: '65+', label: '65 Jahre und älter', minAge: 65, maxAge: null },
]

export interface ReferenceValueEntry extends NutrientRequirement {
  ageGroupId: string
  gender: Gender
}

const ENERGY_SOURCE = 'https://www.dge.de/wissenschaft/referenzwerte/energie/ (Abruf: 22.08.2026)'
const PROTEIN_SOURCE = 'https://www.dge.de/wissenschaft/referenzwerte/protein/ (Abruf: 22.08.2026)'
const FAT_SOURCE =
  'https://www.dge.de/wissenschaft/referenzwerte/fett-essenzielle-fettsaeuren/ (Abruf: 22.08.2026)'
const CARBS_SOURCE =
  'https://www.dge.de/wissenschaft/referenzwerte/kohlenhydrate/ (Abruf: 22.08.2026)'
const FIBER_SOURCE =
  'https://www.dge.de/wissenschaft/referenzwerte/ballaststoffe/ (Abruf: 22.08.2026)'

/**
 * Energiebedarf ist ein "Richtwert" und hängt vom Aktivitätsniveau (PAL) ab.
 * Die DGE gibt drei Stufen (PAL 1.4/1.6/1.8); hier abgebildet als
 * min (PAL 1.4) / recommended (PAL 1.6) / max (PAL 1.8).
 */
function energy(
  ageGroupId: string,
  gender: Gender,
  pal14: number,
  pal16: number,
  pal18: number,
): ReferenceValueEntry {
  return {
    ageGroupId,
    gender,
    nutrientId: 'energy',
    unit: 'kcal',
    referenceType: 'richtwert',
    min: pal14,
    recommended: pal16,
    max: pal18,
    source: ENERGY_SOURCE,
  }
}

function protein(
  ageGroupId: string,
  gender: Gender,
  recommended: number,
  perKgBodyWeight?: number,
): ReferenceValueEntry {
  return {
    ageGroupId,
    gender,
    nutrientId: 'protein',
    unit: 'g',
    referenceType: 'empfohleneZufuhr',
    recommended,
    perKgBodyWeight,
    source: PROTEIN_SOURCE,
  }
}

function fatForAgeGroup(ageGroupId: string, gender: Gender): ReferenceValueEntry {
  return {
    ageGroupId,
    gender,
    nutrientId: 'fat',
    unit: '%energy',
    referenceType: 'richtwert',
    recommended: 30,
    source: FAT_SOURCE,
  }
}

function carbohydratesForAgeGroup(ageGroupId: string, gender: Gender): ReferenceValueEntry {
  return {
    ageGroupId,
    gender,
    nutrientId: 'carbohydrates',
    unit: '%energy',
    referenceType: 'richtwert',
    min: 50,
    source: CARBS_SOURCE,
  }
}

function fiberForAgeGroup(ageGroupId: string, gender: Gender): ReferenceValueEntry {
  // 15–19: dichtebasiert (g pro 1000 kcal), da hier noch wie bei Kindern/Jugendlichen
  // keine feste Gramm-Angabe existiert. Ab 19 Jahren: fixer Mindestwert in g/Tag.
  if (ageGroupId === '15-19') {
    return {
      ageGroupId,
      gender,
      nutrientId: 'fiber',
      unit: 'g/1000kcal',
      referenceType: 'richtwert',
      min: 14.6,
      source: FIBER_SOURCE,
    }
  }
  return {
    ageGroupId,
    gender,
    nutrientId: 'fiber',
    unit: 'g',
    referenceType: 'richtwert',
    min: 30,
    source: FIBER_SOURCE,
  }
}

const GENDERS: Gender[] = ['male', 'female']

export const REFERENCE_VALUES: ReferenceValueEntry[] = [
  // Energie (kcal/Tag), PAL 1.4 / 1.6 / 1.8
  energy('15-19', 'male', 2600, 3000, 3400),
  energy('15-19', 'female', 2000, 2300, 2600),
  energy('19-25', 'male', 2400, 2800, 3100),
  energy('19-25', 'female', 1900, 2200, 2500),
  energy('25-51', 'male', 2300, 2700, 3000),
  energy('25-51', 'female', 1800, 2100, 2400),
  energy('51-65', 'male', 2200, 2500, 2800),
  energy('51-65', 'female', 1700, 2000, 2200),
  energy('65+', 'male', 2100, 2500, 2800),
  energy('65+', 'female', 1700, 1900, 2100),

  // Protein (g/Tag, bezogen auf DACH-Referenzgewicht; g/kg Körpergewicht wo angegeben)
  protein('15-19', 'male', 62),
  protein('15-19', 'female', 48),
  protein('19-25', 'male', 57, 0.8),
  protein('19-25', 'female', 48, 0.8),
  protein('25-51', 'male', 57, 0.8),
  protein('25-51', 'female', 48, 0.8),
  protein('51-65', 'male', 55, 0.8),
  protein('51-65', 'female', 47, 0.8),
  protein('65+', 'male', 67, 1.0),
  protein('65+', 'female', 57, 1.0),

  // Fett (% der Energiezufuhr) — für 15–65+ konstant 30%
  ...AGE_GROUPS.flatMap((group) => GENDERS.map((gender) => fatForAgeGroup(group.id, gender))),

  // Kohlenhydrate (≥ 50% der Energiezufuhr, altersunabhängig laut DGE)
  ...AGE_GROUPS.flatMap((group) =>
    GENDERS.map((gender) => carbohydratesForAgeGroup(group.id, gender)),
  ),

  // Ballaststoffe
  ...AGE_GROUPS.flatMap((group) => GENDERS.map((gender) => fiberForAgeGroup(group.id, gender))),
]
