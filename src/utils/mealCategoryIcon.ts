/**
 * Rein präsentationsseitige Zuordnung Rezept → Mahlzeiten-Kategorie, für ein
 * kleines Icon in der Rezeptliste (siehe DESIGN.md, "Bilder"). Bewusst NICHT
 * im Recipe-Datenmodell abgelegt — diese Instruktion ist ein Design-Pass
 * ohne Änderungen an Datenmodellen (siehe "Was nicht Teil dieses Auftrags
 * ist"), daher lebt die Zuordnung ausschliesslich hier in der View-Schicht.
 */
export type MealCategory = 'breakfast' | 'main' | 'snack'

const CATEGORY_BY_RECIPE_ID: Record<string, MealCategory> = {
  'overnight-oats-banane': 'breakfast',
  'ruehrei-vollkornbrot': 'breakfast',
  'joghurt-honig-nuesse': 'snack',
  'pouletbrust-reis-broccoli': 'main',
  'lachs-kartoffeln-spinat': 'main',
  'quinoa-bowl-avocado-tomate': 'main',
  'magerquark-apfel-honig': 'snack',
  'gemuesepfanne-teigwaren': 'main',
}

const CATEGORY_LABELS: Record<MealCategory, string> = {
  breakfast: 'Frühstück',
  main: 'Hauptmahlzeit',
  snack: 'Snack',
}

const CATEGORY_ICONS: Record<MealCategory, string> = {
  // Sonnenaufgang
  breakfast: '<path d="M4 15h16M7 15a5 5 0 0 1 10 0M12 6v3M6.5 8.5l1.8 1.8M17.5 8.5l-1.8 1.8" />',
  // Teller mit Besteck
  main: '<circle cx="12" cy="13" r="6" /><path d="M12 13h3M5 5v5M5 5c-1.2 0-2 1-2 2s.8 2 2 2M8 5v4" />',
  // Blatt
  snack: '<path d="M5 19c9 0 14-5 14-14-9 0-14 5-14 14ZM5 19c0-4 2-7 5-9" />',
}

export function getMealCategory(recipeId: string): MealCategory | undefined {
  return CATEGORY_BY_RECIPE_ID[recipeId]
}

export function renderMealCategoryIcon(category: MealCategory): string {
  const label = CATEGORY_LABELS[category]
  return `
    <svg class="meal-category-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}">
      ${CATEGORY_ICONS[category]}
    </svg>
  `
}
