import { getFoodById } from '../../data/foodDatabaseService.ts'
import type { FoodItem } from '../../data/models/food.ts'
import type { UserProfile } from '../../data/models/userProfile.ts'
import { getRequirementsForProfile } from '../nutrient-requirements/requirementService.ts'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import { getRecipeById } from './recipeService.ts'
import { calculatePerServing } from './nutritionCalculator.ts'
import { renderNutritionSummary } from '../nutrition-summary/nutritionSummaryView.ts'
import type { NutritionSummaryHandle } from '../nutrition-summary/nutritionSummaryView.ts'
import { formatNumber } from '../../utils/formatNumber.ts'

export interface RecipeDetailViewOptions {
  container: HTMLElement
  recipeId: string
  profile: UserProfile
  onBack: () => void
}

// Nur eine Detailansicht ist je aktiv — vor jedem Neu-Rendern und beim
// Verlassen der Ansicht wird das vorherige Chart sauber zerstört (Chart.js
// hält sonst Referenzen auf das entfernte Canvas, z.B. für Resize-Handling).
let activeSummary: NutritionSummaryHandle | null = null

function destroyActiveSummary(): void {
  activeSummary?.destroy()
  activeSummary = null
}

/** Siehe Instruktion 2/3: für nicht abgedeckte Altersgruppen (<15 Jahre) gibt es keine DACH-Referenzwerte. */
function getRequirementsSafely(profile: UserProfile): NutrientRequirement[] {
  try {
    return getRequirementsForProfile(profile)
  } catch {
    return []
  }
}

export async function renderRecipeDetailView(options: RecipeDetailViewOptions): Promise<void> {
  const { container, recipeId, profile, onBack } = options
  destroyActiveSummary()

  const handleBack = (): void => {
    destroyActiveSummary()
    onBack()
  }

  container.innerHTML = `
    <section class="recipe-detail">
      <p class="recipe-list__status">Lade Rezept…</p>
    </section>
  `

  const recipe = await getRecipeById(recipeId)
  if (!recipe) {
    container.innerHTML = `
      <section class="recipe-detail">
        <p class="field-error" role="alert">Rezept nicht gefunden.</p>
        <button type="button" class="button-secondary" data-action="back">Zurück</button>
      </section>
    `
    container.querySelector('[data-action="back"]')?.addEventListener('click', handleBack)
    return
  }

  const foods = await Promise.all(recipe.ingredients.map((ing) => getFoodById(ing.foodId)))
  const foodsById = new Map<string, FoodItem>()
  foods.forEach((food, index) => {
    if (food) foodsById.set(recipe.ingredients[index]!.foodId, food)
  })

  const perServing = calculatePerServing(recipe, foodsById)
  const requirements = getRequirementsSafely(profile)

  const ingredientRows = recipe.ingredients
    .map((ingredient) => {
      const food = foodsById.get(ingredient.foodId)
      const name = food?.name.de ?? `Unbekannte Zutat (${ingredient.foodId})`
      return `<tr><td>${name}</td><td>${formatNumber(ingredient.amountGrams)} g</td></tr>`
    })
    .join('')

  container.innerHTML = `
    <section class="recipe-detail">
      <h1>${recipe.name}</h1>
      <p class="recipe-detail__meta">${recipe.servings} Portion${recipe.servings === 1 ? '' : 'en'}</p>

      <h2>Zutaten</h2>
      <table class="recipe-detail__table">
        <tbody>${ingredientRows}</tbody>
      </table>

      <div data-summary-container></div>

      <button type="button" class="button-secondary" data-action="back">Zurück zur Rezeptliste</button>
    </section>
  `

  const summaryContainer = container.querySelector<HTMLDivElement>('[data-summary-container]')
  if (summaryContainer) {
    activeSummary = renderNutritionSummary({
      container: summaryContainer,
      nutrientValues: perServing,
      requirements,
      profile,
      heading: 'Nährwerte pro Portion',
    })
  }

  container.querySelector('[data-action="back"]')?.addEventListener('click', handleBack)
}
