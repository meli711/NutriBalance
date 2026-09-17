/**
 * Deutsche Anzeige-Labels für die Nova-Klassifikation nach Verarbeitungsgrad
 * (Instruktion 17), analog zu `NUTRIENT_LABELS` in `nutrientLabels.ts`.
 */
export const NOVA_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Unverarbeitet / gering verarbeitet',
  2: 'Verarbeitete kulinarische Zutat',
  3: 'Verarbeitetes Lebensmittel',
  4: 'Ultra-verarbeitetes Lebensmittel',
}
