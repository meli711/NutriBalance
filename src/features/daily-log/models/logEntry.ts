interface LogEntryBase {
  id: string
  /** `YYYY-MM-DD`, lokales Datum — siehe `utils/date.ts#getLocalDateString`. */
  date: string
  /**
   * Wie oft dieser Eintrag an diesem Tag vorkommt (z.B. 2 = zweimal),
   * unabhängig von `amountGrams`/`servings` (Instruktion 15). Neue
   * Einträge setzen `factor: 1` als Default. Ältere, vor Instruktion 15
   * im IndexedDB gespeicherte Einträge haben dieses Feld zur Laufzeit noch
   * nicht — siehe `normalizeLogEntry` in `indexedDbService.ts`, das es
   * beim Lesen defensiv auf `1` setzt.
   */
  factor: number
}

export interface FoodLogEntry extends LogEntryBase {
  type: 'food'
  foodId: string
  amountGrams: number
}

export interface RecipeLogEntry extends LogEntryBase {
  type: 'recipe'
  recipeId: string
}

export interface MenuLogEntry extends LogEntryBase {
  type: 'menu'
  menuId: string
}

export type LogEntry = FoodLogEntry | RecipeLogEntry | MenuLogEntry
