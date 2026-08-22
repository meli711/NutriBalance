import { getFoodById } from '../../data/foodDatabaseService.ts'
import type { FoodItem } from '../../data/models/food.ts'
import type { UserProfile } from '../../data/models/userProfile.ts'
import { deleteMenu, getMenuById } from '../../data/indexedDbService.ts'
import { getRequirementsForProfile } from '../nutrient-requirements/requirementService.ts'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import { calculateNutrition } from '../recipes/nutritionCalculator.ts'
import { renderNutritionSummary } from '../nutrition-summary/nutritionSummaryView.ts'
import type { NutritionSummaryHandle } from '../nutrition-summary/nutritionSummaryView.ts'
import { formatNumber } from '../../utils/formatNumber.ts'

export interface MenuDetailViewOptions {
  container: HTMLElement
  menuId: string
  profile: UserProfile
  onBack: () => void
  onDeleted: () => void
}

let activeSummary: NutritionSummaryHandle | null = null

function destroyActiveSummary(): void {
  activeSummary?.destroy()
  activeSummary = null
}

function getRequirementsSafely(profile: UserProfile): NutrientRequirement[] {
  try {
    return getRequirementsForProfile(profile)
  } catch {
    return []
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export async function renderMenuDetailView(options: MenuDetailViewOptions): Promise<void> {
  const { container, menuId, profile, onBack, onDeleted } = options
  destroyActiveSummary()

  const handleBack = (): void => {
    destroyActiveSummary()
    onBack()
  }

  container.innerHTML = `
    <section class="recipe-detail">
      <p class="recipe-list__status">Lade Menü…</p>
    </section>
  `

  const menu = await getMenuById(menuId)
  if (!menu) {
    container.innerHTML = `
      <section class="recipe-detail">
        <p class="field-error" role="alert">Menü nicht gefunden.</p>
        <button type="button" class="button-secondary" data-action="back">Zurück</button>
      </section>
    `
    container.querySelector('[data-action="back"]')?.addEventListener('click', handleBack)
    return
  }

  const foods = await Promise.all(menu.ingredients.map((ing) => getFoodById(ing.foodId)))
  const foodsById = new Map<string, FoodItem>()
  foods.forEach((food, index) => {
    if (food) foodsById.set(menu.ingredients[index]!.foodId, food)
  })

  const nutrientValues = calculateNutrition(menu.ingredients, foodsById)
  const requirements = getRequirementsSafely(profile)

  const ingredientRows = menu.ingredients
    .map((ingredient) => {
      const food = foodsById.get(ingredient.foodId)
      const name = food?.name.de ?? `Unbekannte Zutat (${ingredient.foodId})`
      return `<tr><td>${name}</td><td>${formatNumber(ingredient.amountGrams)} g</td></tr>`
    })
    .join('')

  container.innerHTML = `
    <section class="recipe-detail">
      <h1>${menu.name}</h1>
      <p class="recipe-detail__meta">Erstellt am ${formatDate(menu.createdAt)}</p>
      ${menu.description ? `<p class="recipe-detail__meta">${menu.description}</p>` : ''}

      <h2>Zutaten</h2>
      <table class="recipe-detail__table">
        <tbody>${ingredientRows}</tbody>
      </table>

      <div data-summary-container></div>

      <div class="profile-view__actions">
        <button type="button" class="button-secondary" data-action="back">Zurück zur Menü-Liste</button>
        <button type="button" class="menu-list__delete-full" data-action="delete">Menü löschen</button>
      </div>
    </section>
  `

  const summaryContainer = container.querySelector<HTMLDivElement>('[data-summary-container]')
  if (summaryContainer) {
    activeSummary = renderNutritionSummary({
      container: summaryContainer,
      nutrientValues,
      requirements,
      profile,
      heading: 'Nährwerte',
    })
  }

  container.querySelector('[data-action="back"]')?.addEventListener('click', handleBack)
  container.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
    if (!window.confirm('Dieses Menü wirklich löschen?')) return
    await deleteMenu(menuId)
    destroyActiveSummary()
    onDeleted()
  })
}
