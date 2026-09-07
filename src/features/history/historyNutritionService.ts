import { getLogEntriesInRange } from '../../data/indexedDbService.ts'
import { buildDailyLogContext, sumDailyNutrition } from '../daily-log/dailyNutritionService.ts'
import type { DailyLogContext } from '../daily-log/dailyNutritionService.ts'
import type { NutrientValues } from '../recipes/models/nutritionValues.ts'
import type { LogEntry } from '../daily-log/models/logEntry.ts'

/**
 * Reine Kernfunktion (synchron, ohne I/O — analog zu `sumDailyNutrition`):
 * summiert die Aufnahme pro Tag für einen ganzen Zeitraum. Für `node:test`
 * ohne IndexedDB/fetch testbar.
 *
 * - Jedes Datum aus `dates` kommt in der Map vor. Tage ohne Log-Einträge
 *   erhalten `[]` (nicht ausgelassen), damit die Verlauf-Seite "an dem Tag
 *   nichts geloggt" von "an dem Tag kein Protein" unterscheiden kann.
 * - `incomplete`-Flags reicht das darunterliegende `sumDailyNutrition` bereits
 *   pro Tag korrekt weiter.
 */
export function sumNutritionByDate(
  dates: string[],
  entries: LogEntry[],
  context: DailyLogContext,
): Map<string, NutrientValues> {
  const entriesByDate = new Map<string, LogEntry[]>()
  for (const entry of entries) {
    const list = entriesByDate.get(entry.date) ?? []
    list.push(entry)
    entriesByDate.set(entry.date, list)
  }

  const result = new Map<string, NutrientValues>()
  for (const date of dates) {
    const dayEntries = entriesByDate.get(date) ?? []
    result.set(date, dayEntries.length > 0 ? sumDailyNutrition(dayEntries, context) : [])
  }
  return result
}

/**
 * Dünner I/O-Wrapper um `sumNutritionByDate`: lädt die Log-Einträge des
 * Zeitraums mit einer einzigen Bereichsabfrage und baut den Referenzdaten-
 * Kontext **einmal** für alle Einträge (nicht pro Tag).
 */
export async function calculateNutritionHistory(
  dates: string[],
): Promise<Map<string, NutrientValues>> {
  if (dates.length === 0) return new Map()

  const start = dates[0]!
  const end = dates[dates.length - 1]!
  const entries = await getLogEntriesInRange(start, end)
  const context = await buildDailyLogContext(entries)
  return sumNutritionByDate(dates, entries, context)
}
