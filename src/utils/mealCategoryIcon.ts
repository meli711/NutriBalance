/**
 * Rein präsentationsseitige Icon-Zuordnung für die Rezeptliste (siehe
 * DESIGN.md, "Bilder"). Der Kategorie-Wert selbst lebt seit Instruktion 20
 * direkt am Rezept (`Recipe.category`, `recipes.json`) — bewusst als
 * lesbares deutsches Label statt eines technischen Codes, damit die Angabe
 * beim manuellen Bearbeiten von `recipes.json` zugleich als Kommentar/
 * Beschriftung lesbar ist, ohne eine Code-Tabelle nachschlagen zu müssen
 * (bis Instruktion 20 gab es hier stattdessen eine feste ID→Kategorie-
 * Tabelle, die man beim Hinzufügen eines Rezepts leicht vergisst).
 */
export type MealCategory = 'Frühstück' | 'Hauptmahlzeit' | 'Snack' | 'Getränk' | 'Vorspeise'

export const MEAL_CATEGORIES: readonly MealCategory[] = [
  'Frühstück',
  'Hauptmahlzeit',
  'Snack',
  'Getränk',
  'Vorspeise',
]

export function isMealCategory(value: unknown): value is MealCategory {
  return typeof value === 'string' && (MEAL_CATEGORIES as readonly string[]).includes(value)
}

const CATEGORY_ICONS: Record<MealCategory, string> = {
  // Sonnenaufgang
  Frühstück: '<path d="M4 15h16M7 15a5 5 0 0 1 10 0M12 6v3M6.5 8.5l1.8 1.8M17.5 8.5l-1.8 1.8" />',
  // Teller mit Besteck
  Hauptmahlzeit:
    '<circle cx="12" cy="13" r="6" /><path d="M12 13h3M5 5v5M5 5c-1.2 0-2 1-2 2s.8 2 2 2M8 5v4" />',
  // Blatt
  Snack: '<path d="M5 19c9 0 14-5 14-14-9 0-14 5-14 14ZM5 19c0-4 2-7 5-9" />',
  // Glas mit Trinkhalm
  Getränk:
    '<path d="M8 4h8l-.8 13.2a2 2 0 0 1-2 1.8h-2.4a2 2 0 0 1-2-1.8L8 4Z" /><path d="M9 8h6" /><path d="M14 3v3" />',
  // Schale mit aufsteigendem Dampf
  Vorspeise: '<path d="M4 12h16a8 8 0 0 1-16 0Z" /><path d="M9 12V9M12 12V8M15 12V9" />',
}

export function renderMealCategoryIcon(category: MealCategory): string {
  return `
    <svg class="meal-category-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${category}">
      ${CATEGORY_ICONS[category]}
    </svg>
  `
}
