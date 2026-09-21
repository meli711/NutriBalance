export interface RecipeIngredient {
  /** Referenziert FoodItem.id aus food-database.json (siehe Instruktion 2). */
  foodId: string
  amountGrams: number
}

export interface Recipe {
  id: string
  name: string
  /**
   * Entspricht immer genau einer Portion (Instruktion 19 — bis dahin gab es
   * hier ein zusätzliches `servings`-Feld für Batch-Zubereitungen mit
   * Divisor). Wer eine grössere Zubereitung abbilden will, trägt die volle
   * Zutatenmenge ein und loggt sie ggf. mit `factor` mehrfach (analog zu
   * Menüs, siehe `LogEntryBase.factor`).
   */
  ingredients: RecipeIngredient[]
  /** Optional, kurze Zubereitungsschritte. */
  instructions?: string[]
}
