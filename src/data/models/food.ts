/**
 * Mehrsprachiger Text. Die Quelldatenbank (naehrwertdaten.ch) liefert aktuell
 * nur Deutsch (`de`); die übrigen Sprachen sind vorgesehen, damit spätere
 * Sprachversionen der Datenbank ohne Modelländerung eingebunden werden können.
 */
export interface LocalizedText {
  de: string
  fr?: string
  it?: string
  en?: string
}

/** Ein Nährstoffwert inkl. Einheit. `value: null` bedeutet: in der Quelle nicht angegeben (nicht: 0). */
export interface NutrientValue {
  value: number | null
  unit: string
}

export interface FoodVitamins {
  aRetinolEquivalent: NutrientValue // Vitamin A-Aktivität, RE (µg)
  aRetinolActivityEquivalent: NutrientValue // Vitamin A-Aktivität, RAE (µg)
  retinol: NutrientValue // µg
  betaCaroteneActivity: NutrientValue // Betacarotin-Aktivität (µg)
  betaCarotene: NutrientValue // Betacarotin (µg)
  b1Thiamin: NutrientValue // mg
  b2Riboflavin: NutrientValue // mg
  b6Pyridoxin: NutrientValue // mg
  b12Cobalamin: NutrientValue // µg
  niacinEquivalent: NutrientValue // mg
  niacin: NutrientValue // mg
  folate: NutrientValue // µg
  pantothenicAcid: NutrientValue // mg
  c: NutrientValue // Ascorbinsäure, mg
  d: NutrientValue // Calciferol, µg
  e: NutrientValue // α-Tocopherol, mg
}

export interface FoodMinerals {
  potassium: NutrientValue // mg
  sodium: NutrientValue // mg
  chloride: NutrientValue // mg
  calcium: NutrientValue // mg
  magnesium: NutrientValue // mg
  phosphorus: NutrientValue // mg
  iron: NutrientValue // mg
  iodine: NutrientValue // µg
  zinc: NutrientValue // mg
  selenium: NutrientValue // µg
  salt: NutrientValue // Salz (NaCl), g — separat von Natrium (Na, mg)
}

/**
 * Ein Lebensmittel aus der Schweizer Nährwertdatenbank, Werte jeweils
 * pro 100g essbarem Anteil. Siehe `scripts/convert-food-db.ts` für die
 * Spalten-Zuordnung aus der Quell-Excel-Datei.
 */
export interface FoodItem {
  id: string
  name: LocalizedText
  synonyms?: string[]
  category: string

  energyKcal: number | null

  // Makronährstoffe, jeweils in Gramm pro 100g
  protein: number | null
  fat: number | null
  saturatedFat: number | null
  carbohydrates: number | null
  sugar: number | null
  fiber: number | null

  water: number | null // g
  alcohol: number | null // g

  vitamins: FoodVitamins
  minerals: FoodMinerals
}
