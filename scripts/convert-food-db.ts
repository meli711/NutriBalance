/**
 * Konvertiert die Schweizer Nährwertdatenbank (naehrwertdaten.ch) von Excel
 * nach JSON.
 *
 * Quelle:  quellen/Schweizer_Nahrwertdatenbank.xlsx, Sheet "Generische
 *          Lebensmittel" (Markenprodukte sind nicht Teil dieser Konvertierung).
 * Output:  public/data/food-database.json
 * Aufruf:  npm run convert:food-db
 *
 * Spalten-Layout der Quelldatei (0-indiziert, Header in Zeile 3 = Index 2):
 *   0 ID | 3 Name | 4 Synonyme | 5 Kategorie
 *   Ab Spalte 8 folgen pro Nährstoff je 3 Spalten: [Wert, Herleitung des
 *   Wertes, Quelle]. Nur die Wert-Spalte wird übernommen — Herleitung/Quelle
 *   sind Metadaten der Nährwertdatenbank selbst, nicht Teil des FoodItem-Modells.
 *
 * Sprache: Die Quelldatei enthält nur die deutsche Sprachspalte (Name,
 * Synonyme, Kategorie). Das Datenmodell (`LocalizedText`) ist trotzdem so
 * angelegt, dass spätere Sprachversionen (fr/it/en) ohne Modelländerung ergänzt
 * werden können — diese Felder bleiben hier einfach undefiniert.
 *
 * Fehlende Werte: Die Quelldatei markiert fehlende Werte als Text (z.B.
 * "k.A." = keine Angabe, "Sp." = Spuren/nicht quantifizierbar, oder
 * Schwellenwerte wie "<0.5"). Für die Matura-Arbeit ist wichtig, fehlende
 * Werte nicht mit einem tatsächlichen Nullgehalt zu verwechseln. Deshalb wird
 * jede Zelle, die sich nicht sauber als Zahl parsen lässt, als `null`
 * abgebildet (siehe `parseNutrientValue`) — nicht als 0, und auch nicht als
 * Näherung des Schwellenwerts, da das eine Genauigkeit vortäuschen würde,
 * die die Quelle nicht liefert.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import type {
  FoodItem,
  FoodMinerals,
  FoodVitamins,
  NutrientValue,
} from '../src/data/models/food.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const SOURCE_FILE = resolve(PROJECT_ROOT, 'quellen/Schweizer_Nahrwertdatenbank.xlsx')
const SHEET_NAME = 'Generische Lebensmittel'
const HEADER_ROW_INDEX = 2 // Zeile 1 = Titel, Zeile 2 = leer, Zeile 3 = Spaltenüberschriften
const OUTPUT_FILE = resolve(PROJECT_ROOT, 'public/data/food-database.json')

/**
 * Eigene Produkte (Markenprodukte, die Meliane erfasst hat), die es in der
 * generischen BLV-Datenbank nicht gibt. Anders als `quellen/` sonst ist diese
 * Datei _unsere_ Daten und im Repo eingecheckt (siehe `.gitignore`-Ausnahme),
 * damit `npm run convert:food-db` die `food-database.json` auf jedem Clone
 * reproduziert. Format: JSON-Array von `FoodItem`-Objekten (gleiche Struktur
 * wie ein Eintrag in der Ausgabedatei), Werte pro 100 g. Einträge mit einer
 * `id`, die auch aus der Excel kommt, überschreiben den generischen Eintrag;
 * alle übrigen werden angehängt.
 */
const CUSTOM_PRODUCTS_FILE = resolve(PROJECT_ROOT, 'quellen/eigene-produkte.json')

// Spaltenindizes der Basis-Felder
const COL = {
  id: 0,
  name: 3,
  synonyms: 4,
  category: 5,
  energyKcal: 11, // "Energie, Kilokalorien (kcal)"
  fat: 14, // "Fett, total (g)"
  saturatedFat: 17, // "Fettsäuren, gesättigt (g)"
  carbohydrates: 41, // "Kohlenhydrate, verfügbar (g)"
  sugar: 44, // "Zucker (g)"
  fiber: 50, // "Nahrungsfasern (g)"
  protein: 53, // "Protein (g)"
  salt: 56, // "Salz (NaCl) (g)"
  alcohol: 59, // "Alkohol (g)"
  water: 62, // "Wasser (g)"

  vitAActivityRE: 65,
  vitAActivityRAE: 68,
  retinol: 71,
  betaCaroteneActivity: 74,
  betaCarotene: 77,
  vitB1: 80,
  vitB2: 83,
  vitB6: 86,
  vitB12: 89,
  niacinEquivalent: 92,
  niacin: 95,
  folate: 98,
  pantothenicAcid: 101,
  vitC: 104,
  vitD: 107,
  vitE: 110,

  potassium: 113,
  sodium: 116,
  chloride: 119,
  calcium: 122,
  magnesium: 125,
  phosphorus: 128,
  iron: 131,
  iodine: 134,
  zinc: 137,
  selenium: 140,
} as const

type SourceRow = (string | number | null)[]

/**
 * Wandelt eine Rohzelle in eine Zahl oder `null` um. Alles, was kein reiner
 * numerischer Wert ist (Text-Marker wie "k.A."/"Sp.", Schwellenwerte wie
 * "<0.5", leere Zellen), wird als `null` (= unbekannt) behandelt.
 */
function parseNutrientValue(raw: string | number | null): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  return null
}

function nutrient(row: SourceRow, colIndex: number, unit: string): NutrientValue {
  return { value: parseNutrientValue(row[colIndex] ?? null), unit }
}

function parseSynonyms(raw: string | number | null): string[] | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function toFoodItem(row: SourceRow): FoodItem {
  const vitamins: FoodVitamins = {
    aRetinolEquivalent: nutrient(row, COL.vitAActivityRE, 'µg'),
    aRetinolActivityEquivalent: nutrient(row, COL.vitAActivityRAE, 'µg'),
    retinol: nutrient(row, COL.retinol, 'µg'),
    betaCaroteneActivity: nutrient(row, COL.betaCaroteneActivity, 'µg'),
    betaCarotene: nutrient(row, COL.betaCarotene, 'µg'),
    b1Thiamin: nutrient(row, COL.vitB1, 'mg'),
    b2Riboflavin: nutrient(row, COL.vitB2, 'mg'),
    b6Pyridoxin: nutrient(row, COL.vitB6, 'mg'),
    b12Cobalamin: nutrient(row, COL.vitB12, 'µg'),
    niacinEquivalent: nutrient(row, COL.niacinEquivalent, 'mg'),
    niacin: nutrient(row, COL.niacin, 'mg'),
    folate: nutrient(row, COL.folate, 'µg'),
    pantothenicAcid: nutrient(row, COL.pantothenicAcid, 'mg'),
    c: nutrient(row, COL.vitC, 'mg'),
    d: nutrient(row, COL.vitD, 'µg'),
    e: nutrient(row, COL.vitE, 'mg'),
  }

  const minerals: FoodMinerals = {
    potassium: nutrient(row, COL.potassium, 'mg'),
    sodium: nutrient(row, COL.sodium, 'mg'),
    chloride: nutrient(row, COL.chloride, 'mg'),
    calcium: nutrient(row, COL.calcium, 'mg'),
    magnesium: nutrient(row, COL.magnesium, 'mg'),
    phosphorus: nutrient(row, COL.phosphorus, 'mg'),
    iron: nutrient(row, COL.iron, 'mg'),
    iodine: nutrient(row, COL.iodine, 'µg'),
    zinc: nutrient(row, COL.zinc, 'mg'),
    selenium: nutrient(row, COL.selenium, 'µg'),
    salt: nutrient(row, COL.salt, 'g'),
  }

  return {
    id: String(row[COL.id]),
    name: { de: String(row[COL.name]).trim() },
    synonyms: parseSynonyms(row[COL.synonyms]),
    category: String(row[COL.category] ?? '').trim(),
    energyKcal: parseNutrientValue(row[COL.energyKcal]),
    protein: parseNutrientValue(row[COL.protein]),
    fat: parseNutrientValue(row[COL.fat]),
    saturatedFat: parseNutrientValue(row[COL.saturatedFat]),
    carbohydrates: parseNutrientValue(row[COL.carbohydrates]),
    sugar: parseNutrientValue(row[COL.sugar]),
    fiber: parseNutrientValue(row[COL.fiber]),
    water: parseNutrientValue(row[COL.water]),
    alcohol: parseNutrientValue(row[COL.alcohol]),
    vitamins,
    minerals,
  }
}

/**
 * Prüft grob, dass ein Objekt aus `eigene-produkte.json` die Pflichtfelder
 * eines `FoodItem` hat. Kein vollständiges Schema — nur so viel, dass ein
 * Tippfehler in der Quelldatei hier auffällt und nicht erst in der App.
 */
function assertFoodItem(item: unknown, index: number): asserts item is FoodItem {
  const where = `eigene-produkte.json[${index}]`
  if (item == null || typeof item !== 'object') {
    throw new Error(`${where}: kein Objekt`)
  }
  const record = item as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.trim() === '') {
    throw new Error(`${where}: "id" fehlt oder ist leer`)
  }
  const name = record.name as { de?: unknown } | undefined
  if (!name || typeof name.de !== 'string' || name.de.trim() === '') {
    throw new Error(`${where}: "name.de" fehlt`)
  }
  if (typeof record.category !== 'string') {
    throw new Error(`${where}: "category" fehlt`)
  }
  if (record.vitamins == null || record.minerals == null) {
    throw new Error(`${where}: "vitamins"/"minerals" fehlen`)
  }
}

/**
 * Mischt die eigenen Produkte aus `eigene-produkte.json` in die aus der Excel
 * erzeugte Liste: gleiche `id` ersetzt den generischen Eintrag an Ort und
 * Stelle, neue `id` wird angehängt. Fehlt die Datei, bleibt `foods`
 * unverändert.
 */
function mergeCustomProducts(foods: FoodItem[]): number {
  if (!existsSync(CUSTOM_PRODUCTS_FILE)) return 0

  const parsed: unknown = JSON.parse(readFileSync(CUSTOM_PRODUCTS_FILE, 'utf-8'))
  if (!Array.isArray(parsed)) {
    throw new Error(`${CUSTOM_PRODUCTS_FILE}: erwartet ein JSON-Array von FoodItem-Objekten`)
  }

  const indexById = new Map(foods.map((food, i) => [food.id, i]))
  parsed.forEach((item, i) => {
    assertFoodItem(item, i)
    const existing = indexById.get(item.id)
    if (existing != null) {
      foods[existing] = item
    } else {
      indexById.set(item.id, foods.length)
      foods.push(item)
    }
  })
  return parsed.length
}

function main(): void {
  const buffer = readFileSync(SOURCE_FILE)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[SHEET_NAME]
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" nicht gefunden in ${SOURCE_FILE}`)
  }

  const rows = XLSX.utils.sheet_to_json<SourceRow>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })
  const dataRows = rows.slice(HEADER_ROW_INDEX + 1)

  const foods: FoodItem[] = dataRows
    .filter((row) => row[COL.id] != null && row[COL.name] != null)
    .map(toFoodItem)
  const generischCount = foods.length

  const customCount = mergeCustomProducts(foods)

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true })
  writeFileSync(OUTPUT_FILE, JSON.stringify(foods))

  console.log(
    `${generischCount} generische + ${customCount} eigene → ${foods.length} Lebensmittel → ${OUTPUT_FILE}`,
  )
}

main()
