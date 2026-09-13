import { getAllLogEntries, getAllMenus } from '../../data/indexedDbService.ts'

/**
 * Prüft vor dem Löschen einer Zutat/eines Menüs, ob sie/es noch anderswo
 * referenziert wird. Die App stürzt bei einer verwaisten Referenz zwar
 * nicht ab (siehe `resolveEntry` in `dailyLogView.ts` bzw. die
 * "Unbekannte Zutat"-Fallbacks in `menuDetailView.ts`/`recipeDetailView.ts`,
 * Instruktion 9) — aber die betroffene Stelle zeigt danach unvollständige
 * Daten. Damit das nicht versehentlich passiert, bekommt die löschende
 * Person hier vorher die Anzahl betroffener Stellen zu sehen (siehe
 * `foodDetailView.ts`, `menuListView.ts`, `menuDetailView.ts`).
 */
export interface FoodUsage {
  /** Anzahl Tages-Log-Einträge, die diese Zutat direkt geloggt haben (`type: 'food'`). */
  logEntries: number
  /** Anzahl Menüs, die diese Zutat als Zutat enthalten. */
  menus: number
}

export async function countFoodUsage(foodId: string): Promise<FoodUsage> {
  const [logEntries, menus] = await Promise.all([getAllLogEntries(), getAllMenus()])
  return {
    logEntries: logEntries.filter((entry) => entry.type === 'food' && entry.foodId === foodId)
      .length,
    menus: menus.filter((menu) => menu.ingredients.some((ing) => ing.foodId === foodId)).length,
  }
}

/** Anzahl Tages-Log-Einträge, die dieses Menü geloggt haben (`type: 'menu'`). */
export async function countMenuUsage(menuId: string): Promise<number> {
  const logEntries = await getAllLogEntries()
  return logEntries.filter((entry) => entry.type === 'menu' && entry.menuId === menuId).length
}

function countLabel(count: number, singular: string, pluralDative: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${pluralDative}`
}

/**
 * Reine Text-Bausteine, getrennt von der eigentlichen Zählung, damit sie
 * ohne IndexedDB testbar sind. Bei fehlender Nutzung bleibt es bei der
 * bisherigen, einfachen Rückfrage — die verschärfte Warnung erscheint nur,
 * wenn beim Löschen tatsächlich etwas unvollständig würde.
 */
export function buildFoodDeleteConfirmMessage(foodName: string, usage: FoodUsage): string {
  if (usage.logEntries === 0 && usage.menus === 0) {
    return `"${foodName}" wirklich löschen?`
  }
  const parts: string[] = []
  if (usage.logEntries > 0) parts.push(countLabel(usage.logEntries, 'Log-Eintrag', 'Log-Einträgen'))
  if (usage.menus > 0) parts.push(countLabel(usage.menus, 'Menü', 'Menüs'))

  return (
    `"${foodName}" wird noch in ${parts.join(' und ')} verwendet. Nach dem Löschen werden diese ` +
    `Stellen als unvollständig bzw. mit unbekannter Zutat angezeigt. Nur löschen, wenn du weisst, ` +
    `was du machst!`
  )
}

export function buildMenuDeleteConfirmMessage(menuName: string, logEntryCount: number): string {
  if (logEntryCount === 0) return `"${menuName}" wirklich löschen?`

  return (
    `"${menuName}" wird noch in ${countLabel(logEntryCount, 'Log-Eintrag', 'Log-Einträgen')} ` +
    `verwendet. Nach dem Löschen werden diese Tage als unvollständig angezeigt. Nur löschen, ` +
    `wenn du weisst, was du machst!`
  )
}
