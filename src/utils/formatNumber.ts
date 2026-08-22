/** Ganzzahlen unverändert, sonst eine Dezimalstelle mit Komma (deutschsprachige Schreibweise). */
export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
}
