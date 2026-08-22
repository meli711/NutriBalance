import type { UserProfile } from '../../data/models/userProfile.ts'
import { saveMenu } from '../../data/indexedDbService.ts'
import { getRequirementsForProfile } from '../nutrient-requirements/requirementService.ts'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import { calculateNutrition } from '../recipes/nutritionCalculator.ts'
import type { RecipeIngredient } from '../recipes/models/recipe.ts'
import type { Menu } from './models/menu.ts'
import { renderNutritionSummary } from '../nutrition-summary/nutritionSummaryView.ts'
import type { NutritionSummaryHandle } from '../nutrition-summary/nutritionSummaryView.ts'
import { renderFoodPicker } from '../shared/foodPickerControl.ts'
import type { FoodItem } from '../../data/models/food.ts'
import { formatNumber } from '../../utils/formatNumber.ts'

export interface MenuBuilderViewOptions {
  container: HTMLElement
  profile: UserProfile
  onSaved: () => void
  onCancel: () => void
}

interface BuilderIngredient extends RecipeIngredient {
  foodName: string
}

/** Siehe Instruktion 2/3: für nicht abgedeckte Altersgruppen (<15 Jahre) gibt es keine DACH-Referenzwerte. */
function getRequirementsSafely(profile: UserProfile): NutrientRequirement[] {
  try {
    return getRequirementsForProfile(profile)
  } catch {
    return []
  }
}

function formatDefaultMenuName(): string {
  const today = new Date().toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  return `Menü vom ${today}`
}

export function renderMenuBuilderView(options: MenuBuilderViewOptions): void {
  const { container, profile, onSaved, onCancel } = options

  const ingredients: BuilderIngredient[] = []
  const foodsById = new Map<string, FoodItem>()
  const requirements = getRequirementsSafely(profile)
  let activeSummary: NutritionSummaryHandle | null = null

  container.innerHTML = `
    <section class="menu-builder">
      <h1>Neues Menü erstellen</h1>

      <div class="field">
        <label for="menu-name">Name</label>
        <input id="menu-name" type="text" placeholder="${formatDefaultMenuName()}" />
      </div>

      <div class="field">
        <label for="menu-description">Beschreibung</label>
        <textarea id="menu-description" rows="2"></textarea>
      </div>

      <div data-food-picker></div>

      <h2>Zutatenliste</h2>
      <ul class="menu-builder__ingredients" data-ingredient-list></ul>

      <p class="field-error" role="alert" hidden data-form-error></p>

      <div data-summary-container></div>

      <div class="profile-view__actions">
        <button type="button" class="button-primary" data-action="save">Speichern</button>
        <button type="button" class="button-secondary" data-action="cancel">Abbrechen</button>
      </div>
    </section>
  `

  const nameInput = container.querySelector<HTMLInputElement>('#menu-name')!
  const descriptionInput = container.querySelector<HTMLTextAreaElement>('#menu-description')!
  const ingredientListEl = container.querySelector<HTMLUListElement>('[data-ingredient-list]')!
  const formError = container.querySelector<HTMLParagraphElement>('[data-form-error]')!
  const summaryContainer = container.querySelector<HTMLDivElement>('[data-summary-container]')!
  const foodPickerContainer = container.querySelector<HTMLDivElement>('[data-food-picker]')!

  function renderIngredientList(): void {
    if (ingredients.length === 0) {
      ingredientListEl.innerHTML =
        '<li class="recipe-list__status">Noch keine Zutaten hinzugefügt.</li>'
      return
    }

    ingredientListEl.innerHTML = ingredients
      .map(
        (ing, index) => `
          <li class="menu-builder__ingredient-row">
            <span>${ing.foodName} — ${formatNumber(ing.amountGrams)} g</span>
            <button type="button" class="menu-list__delete" data-remove-index="${index}" aria-label="Zutat entfernen">✕</button>
          </li>`,
      )
      .join('')

    ingredientListEl
      .querySelectorAll<HTMLButtonElement>('[data-remove-index]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const index = Number(button.dataset.removeIndex)
          ingredients.splice(index, 1)
          renderIngredientList()
          renderLivePreview()
        })
      })
  }

  function renderLivePreview(): void {
    activeSummary?.destroy()
    activeSummary = null

    if (ingredients.length === 0) {
      summaryContainer.innerHTML =
        '<p class="chart-note">Noch keine Zutaten — die Vorschau erscheint nach dem ersten Hinzufügen.</p>'
      return
    }

    const nutrientValues = calculateNutrition(ingredients, foodsById)
    activeSummary = renderNutritionSummary({
      container: summaryContainer,
      nutrientValues,
      requirements,
      profile,
      heading: 'Nährwerte',
    })
  }

  renderFoodPicker({
    container: foodPickerContainer,
    onAdd: (food, amountGrams) => {
      foodsById.set(food.id, food)
      // Bewusst als separater Eintrag, auch wenn dieselbe Zutat schon in der
      // Liste ist (kein Zusammenführen) — siehe Instruktion 6, Edge Cases.
      ingredients.push({ foodId: food.id, foodName: food.name.de, amountGrams })
      renderIngredientList()
      renderLivePreview()
    },
  })

  container.querySelector('[data-action="save"]')?.addEventListener('click', () => {
    void (async () => {
      if (ingredients.length === 0) {
        formError.textContent = 'Bitte mindestens eine Zutat hinzufügen, bevor du speicherst.'
        formError.hidden = false
        return
      }
      formError.hidden = true

      const menu: Menu = {
        id: crypto.randomUUID(),
        name: nameInput.value.trim() || formatDefaultMenuName(),
        description: descriptionInput.value.trim(),
        createdAt: new Date().toISOString(),
        ingredients: ingredients.map(({ foodId, amountGrams }) => ({ foodId, amountGrams })),
      }

      await saveMenu(menu)
      activeSummary?.destroy()
      onSaved()
    })()
  })

  container.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
    activeSummary?.destroy()
    onCancel()
  })

  renderIngredientList()
  renderLivePreview()
}
