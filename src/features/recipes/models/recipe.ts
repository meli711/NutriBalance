export interface RecipeIngredient {
  /** Referenziert FoodItem.id aus food-database.json (siehe Instruktion 2). */
  foodId: string
  amountGrams: number
}

export interface Recipe {
  id: string
  name: string
  /** Anzahl Portionen, die das Rezept ergibt. */
  servings: number
  ingredients: RecipeIngredient[]
  /** Optional, kurze Zubereitungsschritte. */
  instructions?: string[]
}
