import { getFoodById } from '../../data/foodDatabaseService.ts'
import type { FoodItem } from '../../data/models/food.ts'
import type { UserProfile } from '../../data/models/userProfile.ts'
import { getRequirementOverrides } from '../../data/localStorageService.ts'
import {
  applyCustomFoodInput,
  deleteCustomFood,
  isOwnCustomFoodId,
  upsertCustomFood,
} from '../../data/customFoodService.ts'
import { getRequirementsForProfile } from '../nutrient-requirements/requirementService.ts'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import { calculateNutrition } from '../recipes/nutritionCalculator.ts'
import { renderNutritionSummary } from '../nutrition-summary/nutritionSummaryView.ts'
import type { NutritionSummaryHandle } from '../nutrition-summary/nutritionSummaryView.ts'
import { buildFoodDeleteConfirmMessage, countFoodUsage } from '../shared/referenceUsageService.ts'
import { renderCustomFoodForm } from './customFoodForm.ts'

export interface FoodDetailViewOptions {
  container: HTMLElement
  foodId: string
  profile: UserProfile
  /** Zurück zur Zutatenliste — auch nach "Abbrechen"/erfolgreichem Löschen. */
  onBack: () => void
}

// Nur eine Detailansicht ist je aktiv — siehe recipeDetailView.ts/menuDetailView.ts
// für dasselbe Muster (Chart.js hält sonst Referenzen auf das entfernte Canvas).
let activeSummary: NutritionSummaryHandle | null = null

function destroyActiveSummary(): void {
  activeSummary?.destroy()
  activeSummary = null
}

/** Siehe Instruktion 2/3: für nicht abgedeckte Altersgruppen (<15 Jahre) gibt es keine DACH-Referenzwerte. */
function getRequirementsSafely(profile: UserProfile): NutrientRequirement[] {
  try {
    return getRequirementsForProfile(profile, getRequirementOverrides())
  } catch {
    return []
  }
}

/**
 * Detailansicht für **eine** Zutat (Instruktion 14) — Nährwerte fix pro
 * 100 g (wie in der Datenbank selbst, keine Mengen-/Portionsskalierung),
 * über dieselbe `renderNutritionSummary`-Komponente (Tabelle + Chart) wie
 * Rezept-/Menü-Detail, damit keine zweite Chart-Implementierung nötig ist.
 * Ist die Zutat eine eigene, lokal erfasste (`isOwnCustomFoodId`, Instruktion
 * 13), kommen Bearbeiten/Löschen dazu — generische Einträge und
 * Build-Zeit-Markenprodukte (Instruktion 12) bleiben read-only.
 */
export async function renderFoodDetailView(options: FoodDetailViewOptions): Promise<void> {
  const { container, foodId, profile, onBack } = options
  destroyActiveSummary()

  container.innerHTML = `<p class="recipe-list__status">Lade Zutat…</p>`

  const food = await getFoodById(foodId)
  if (!food) {
    container.innerHTML = `
      <section class="recipe-detail">
        <p class="field-error" role="alert">Zutat nicht gefunden.</p>
        <button type="button" class="button-secondary" data-action="back">Zurück</button>
      </section>
    `
    container.querySelector('[data-action="back"]')?.addEventListener('click', onBack)
    return
  }

  const isOwn = isOwnCustomFoodId(food.id)

  function renderView(current: FoodItem): void {
    destroyActiveSummary()

    const foodsById = new Map([[current.id, current]])
    const nutrientValues = calculateNutrition([{ foodId: current.id, amountGrams: 100 }], foodsById)
    const requirements = getRequirementsSafely(profile)

    container.innerHTML = `
      <section class="recipe-detail">
        <h1>${current.name.de}</h1>
        <p class="recipe-detail__meta">${current.category || 'Keine Kategorie'}</p>
        ${
          current.synonyms && current.synonyms.length > 0
            ? `<p class="recipe-detail__meta">Auch bekannt als: ${current.synonyms.join(', ')}</p>`
            : ''
        }

        <div data-summary-container></div>

        <div class="profile-view__actions">
          ${isOwn ? '<button type="button" class="button-secondary" data-action="edit">Bearbeiten</button>' : ''}
          ${isOwn ? '<button type="button" class="menu-list__delete-full" data-action="delete">Löschen</button>' : ''}
          <button type="button" class="button-secondary" data-action="back">Zurück zur Zutatenliste</button>
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
        heading: 'Nährwerte pro 100 g',
      })
    }

    container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      destroyActiveSummary()
      onBack()
    })

    if (isOwn) {
      container.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
        renderEdit(current)
      })
      container.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
        void countFoodUsage(current.id).then((usage) => {
          if (!window.confirm(buildFoodDeleteConfirmMessage(current.name.de, usage))) return
          deleteCustomFood(current.id)
          destroyActiveSummary()
          onBack()
        })
      })
    }
  }

  function renderEdit(current: FoodItem): void {
    destroyActiveSummary()
    container.innerHTML = `<section class="recipe-detail"><h1>${current.name.de}</h1></section>`
    const section = container.querySelector('section')!
    const formContainer = document.createElement('div')
    section.appendChild(formContainer)

    renderCustomFoodForm({
      container: formContainer,
      existingFood: current,
      onSave: (input) => {
        const updated = applyCustomFoodInput(current, input)
        upsertCustomFood(updated)
        renderView(updated)
      },
      onCancel: () => renderView(current),
    })
  }

  renderView(food)
}
