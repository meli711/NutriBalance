import { getFoodById } from '../../data/foodDatabaseService.ts'
import type { FoodItem } from '../../data/models/food.ts'
import { getRecipeById } from './recipeService.ts'
import { calculatePerServing } from './nutritionCalculator.ts'
import { NUTRIENT_LABELS, UNIT_LABELS } from '../../utils/nutrientLabels.ts'

export interface RecipeDetailViewOptions {
  container: HTMLElement
  recipeId: string
  onBack: () => void
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
}

export async function renderRecipeDetailView(options: RecipeDetailViewOptions): Promise<void> {
  const { container, recipeId, onBack } = options

  container.innerHTML = `
    <main>
      <section class="recipe-detail">
        <p class="recipe-list__status">Lade Rezept…</p>
      </section>
    </main>
  `

  const recipe = await getRecipeById(recipeId)
  if (!recipe) {
    container.innerHTML = `
      <main>
        <section class="recipe-detail">
          <p class="field-error" role="alert">Rezept nicht gefunden.</p>
          <button type="button" class="button-secondary" data-action="back">Zurück</button>
        </section>
      </main>
    `
    container.querySelector('[data-action="back"]')?.addEventListener('click', onBack)
    return
  }

  const foods = await Promise.all(recipe.ingredients.map((ing) => getFoodById(ing.foodId)))
  const foodsById = new Map<string, FoodItem>()
  foods.forEach((food, index) => {
    if (food) foodsById.set(recipe.ingredients[index]!.foodId, food)
  })

  const perServing = calculatePerServing(recipe, foodsById)

  const ingredientRows = recipe.ingredients
    .map((ingredient) => {
      const food = foodsById.get(ingredient.foodId)
      const name = food?.name.de ?? `Unbekannte Zutat (${ingredient.foodId})`
      return `<tr><td>${name}</td><td>${formatAmount(ingredient.amountGrams)} g</td></tr>`
    })
    .join('')

  const nutritionRows = perServing
    .map(
      (amount) => `
        <tr>
          <td>${NUTRIENT_LABELS[amount.nutrientId] ?? amount.nutrientId}</td>
          <td>${formatAmount(amount.value)}${amount.incomplete ? '<span class="recipe-detail__incomplete" title="Mindestens eine Zutat hat für diesen Nährstoff keinen Wert in der Datenbank – Wert ist eine Unterschätzung."> *</span>' : ''}</td>
          <td>${UNIT_LABELS[amount.unit] ?? amount.unit}</td>
        </tr>`,
    )
    .join('')

  const hasIncomplete = perServing.some((amount) => amount.incomplete)

  container.innerHTML = `
    <main>
      <section class="recipe-detail">
        <h1>${recipe.name}</h1>
        <p class="recipe-detail__meta">${recipe.servings} Portion${recipe.servings === 1 ? '' : 'en'}</p>

        <h2>Zutaten</h2>
        <table class="recipe-detail__table">
          <tbody>${ingredientRows}</tbody>
        </table>

        <h2>Nährwerte pro Portion</h2>
        <table class="requirements-table">
          <thead>
            <tr><th>Nährstoff</th><th>Wert</th><th>Einheit</th></tr>
          </thead>
          <tbody>${nutritionRows}</tbody>
        </table>
        ${hasIncomplete ? '<p class="recipe-detail__note">* Für mindestens eine Zutat fehlt in der Datenbank ein Wert für diesen Nährstoff — die Angabe ist eine Unterschätzung.</p>' : ''}

        <button type="button" class="button-secondary" data-action="back">Zurück zur Rezeptliste</button>
      </section>
    </main>
  `

  container.querySelector('[data-action="back"]')?.addEventListener('click', onBack)
}
