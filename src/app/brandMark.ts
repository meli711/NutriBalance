/**
 * Signatur-Element (siehe DESIGN.md): zwei einander zugewandte, blattartige
 * Tropfenformen in Grün ("Aufnahme") und Amber ("Bedarf"), die sich in der
 * Mitte berühren — visualisiert die Kernidee der App: zwei Grössen im
 * Gleichgewicht. Erscheint im Header (normal) und Footer (gedämpft, kleiner).
 */
export function renderBrandMark(size = 32): string {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="NutriBalance Signet">
      <path d="M16 16C16 8 10 4 4 4C4 12 8 16 16 16Z" fill="var(--chart-color-intake)" />
      <path d="M16 16C16 24 22 28 28 28C28 20 24 16 16 16Z" fill="var(--chart-color-requirement)" />
    </svg>
  `
}
