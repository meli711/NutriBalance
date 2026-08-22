interface LogEntryBase {
  id: string
  /** `YYYY-MM-DD`, lokales Datum — siehe `utils/date.ts#getLocalDateString`. */
  date: string
}

export interface FoodLogEntry extends LogEntryBase {
  type: 'food'
  foodId: string
  amountGrams: number
}

export interface RecipeLogEntry extends LogEntryBase {
  type: 'recipe'
  recipeId: string
  /** Anzahl gegessener Portionen, z.B. 0.5 für eine halbe Portion. */
  servings: number
}

export interface MenuLogEntry extends LogEntryBase {
  type: 'menu'
  menuId: string
  // Bewusst kein Multiplikator: ein geloggter Menü-Eintrag entspricht dem
  // ganzen Menü, wie es erstellt wurde (siehe Instruktion 9).
}

export type LogEntry = FoodLogEntry | RecipeLogEntry | MenuLogEntry
