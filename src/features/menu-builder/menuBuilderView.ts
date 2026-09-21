import type { UserProfile } from '../../data/models/userProfile.ts'
import { saveMenu } from '../../data/indexedDbService.ts'
import { getRequirementOverrides } from '../../data/localStorageService.ts'
import { getRequirementsForProfile } from '../nutrient-requirements/requirementService.ts'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import { calculateNovaGroup, calculateNutrition } from '../recipes/nutritionCalculator.ts'
import type { RecipeIngredient } from '../recipes/models/recipe.ts'
import type { Menu } from './models/menu.ts'
import { renderNutritionSummary } from '../nutrition-summary/nutritionSummaryView.ts'
import type { NutritionSummaryHandle } from '../nutrition-summary/nutritionSummaryView.ts'
import { renderFoodPicker } from '../shared/foodPickerControl.ts'
import { getFoodById } from '../../data/foodDatabaseService.ts'
import type { FoodItem } from '../../data/models/food.ts'
import { formatNumber } from '../../utils/formatNumber.ts'
import { MEAL_CATEGORIES, isMealCategory } from '../../utils/mealCategoryIcon.ts'

export interface MenuBuilderViewOptions {
  container: HTMLElement
  profile: UserProfile
  onSaved: () => void
  onCancel: () => void
  /** Gesetzt beim Bearbeiten eines bestehenden Menüs (Instruktion 22) — fehlt beim Neu-Erstellen. */
  existingMenu?: Menu
}

interface BuilderIngredient extends RecipeIngredient {
  foodName: string
}

/** Siehe Instruktion 2/3: für nicht abgedeckte Altersgruppen (<15 Jahre) gibt es keine DACH-Referenzwerte. */
function getRequirementsSafely(profile: UserProfile): NutrientRequirement[] {
  try {
    return getRequirementsForProfile(profile, getRequirementOverrides())
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

export async function renderMenuBuilderView(options: MenuBuilderViewOptions): Promise<void> {
  const { container, profile, onSaved, onCancel, existingMenu } = options

  const ingredients: BuilderIngredient[] = []
  const foodsById = new Map<string, FoodItem>()
  const requirements = getRequirementsSafely(profile)
  let activeSummary: NutritionSummaryHandle | null = null

  if (existingMenu) {
    container.innerHTML = `
      <section class="menu-builder">
        <p class="recipe-list__status">Lade Menü…</p>
      </section>
    `
    const foods = await Promise.all(existingMenu.ingredients.map((ing) => getFoodById(ing.foodId)))
    existingMenu.ingredients.forEach((ing, index) => {
      const food = foods[index]
      if (food) foodsById.set(ing.foodId, food)
      ingredients.push({
        foodId: ing.foodId,
        amountGrams: ing.amountGrams,
        foodName: food?.name.de ?? 'Unbekannte Zutat',
      })
    })
  }

  container.innerHTML = `
    <section class="menu-builder">
      <h1>${existingMenu ? 'Menü bearbeiten' : 'Neues Menü erstellen'}</h1>

      <div class="field">
        <label for="menu-name">Name</label>
        <input id="menu-name" type="text" placeholder="${formatDefaultMenuName()}" value="${existingMenu?.name ?? ''}" />
      </div>

      <div class="field">
        <label for="menu-description">Beschreibung</label>
        <textarea id="menu-description" rows="2">${existingMenu?.description ?? ''}</textarea>
      </div>

      <div class="field">
        <label for="menu-category">Kategorie (optional)</label>
        <select id="menu-category">
          <option value="" ${!existingMenu?.category ? 'selected' : ''}>– keine Angabe –</option>
          ${MEAL_CATEGORIES.map(
            (category) =>
              `<option value="${category}" ${existingMenu?.category === category ? 'selected' : ''}>${category}</option>`,
          ).join('')}
        </select>
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
  const categorySelect = container.querySelector<HTMLSelectElement>('#menu-category')!
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
    const novaGroup = calculateNovaGroup(ingredients, foodsById)
    activeSummary = renderNutritionSummary({
      container: summaryContainer,
      nutrientValues,
      requirements,
      profile,
      heading: 'Nährwerte',
      novaGroup,
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

      const category = categorySelect.value
      const menu: Menu = {
        id: existingMenu?.id ?? crypto.randomUUID(),
        name: nameInput.value.trim() || formatDefaultMenuName(),
        description: descriptionInput.value.trim(),
        createdAt: existingMenu?.createdAt ?? new Date().toISOString(),
        ...(category && isMealCategory(category) ? { category } : {}),
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
