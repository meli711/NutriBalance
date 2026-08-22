/**
 * Lokales Datum als `YYYY-MM-DD`, ausdrücklich NICHT über
 * `toISOString()` (die ist UTC-basiert und würde den Tag rund um
 * Mitternacht je nach Zeitzone falsch verschieben — siehe Instruktion 9).
 * `getFullYear()`/`getMonth()`/`getDate()` sind dagegen immer lokal.
 */
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Parst ein `YYYY-MM-DD` zurück in ein lokales `Date` (Mitternacht lokal, nicht UTC). */
function parseLocalDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year!, month! - 1, day!)
}

export function addDaysToDateString(dateStr: string, deltaDays: number): string {
  const date = parseLocalDateString(dateStr)
  date.setDate(date.getDate() + deltaDays)
  return getLocalDateString(date)
}

export function isFutureDateString(dateStr: string): boolean {
  return dateStr > getLocalDateString(new Date())
}

/** z.B. "Heute, 22. August 2026" bzw. "Freitag, 21. August 2026" (siehe Instruktion 9). */
export function formatDateLabel(dateStr: string): string {
  const date = parseLocalDateString(dateStr)
  const longDate = date.toLocaleDateString('de-CH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  if (dateStr === getLocalDateString(new Date())) {
    return `Heute, ${longDate}`
  }
  const weekday = date.toLocaleDateString('de-CH', { weekday: 'long' })
  return `${weekday}, ${longDate}`
}
