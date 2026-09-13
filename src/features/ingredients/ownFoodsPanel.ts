import { createCustomFood, getCustomFoods, upsertCustomFood } from '../../data/customFoodService.ts'
import { rankFoodsByQuery } from '../../data/foodDatabaseService.ts'
import type { FoodItem } from '../../data/models/food.ts'
import { formatNumber } from '../../utils/formatNumber.ts'
import { renderCustomFoodForm } from './customFoodForm.ts'

export interface OwnFoodsPanelOptions {
  container: HTMLElement
  onSelectFood: (foodId: string) => void
}

function summarizeFood(food: FoodItem): string {
  const parts: string[] = []
  if (food.energyKcal !== null) parts.push(`${formatNumber(food.energyKcal)} kcal`)
  if (food.protein !== null) parts.push(`${formatNumber(food.protein)} g Protein`)
  if (food.fat !== null) parts.push(`${formatNumber(food.fat)} g Fett`)
  if (food.carbohydrates !== null) parts.push(`${formatNumber(food.carbohydrates)} g KH`)
  return parts.length > 0 ? `${parts.join(' · ')} (pro 100 g)` : 'Keine Nährwerte erfasst'
}

/**
 * Tab "Eigene Zutaten" (Instruktion 14, umgezogen von der Profilseite,
 * Instruktion 13). Anders als die bisherige `customFoodsSectionView.ts`:
 * ein Klick auf eine Zutat öffnet nicht mehr direkt das Bearbeiten-Formular,
 * sondern dieselbe Detailansicht mit Nährwerttabelle + Chart wie generische
 * Zutaten (`foodDetailView.ts`), die dort Bearbeiten/Löschen anbietet — nur
 * das Erfassen einer **neuen** Zutat passiert weiterhin direkt hier (es gibt
 * ja noch nichts anzuzeigen).
 */
export function renderOwnFoodsPanel(options: OwnFoodsPanelOptions): void {
  const { container, onSelectFood } = options

  let mode: { type: 'list' } | { type: 'create' } = { type: 'list' }

  function setMode(next: typeof mode): void {
    mode = next
    render()
  }

  function renderList(): void {
    container.innerHTML = `
      <p class="profile-view__meta">
        Zutaten, die in der Nährwertdatenbank fehlen, lassen sich hier selbst erfassen
        (nur Energie und Makronährstoffe). Sie stehen danach überall zur Auswahl, wo
        nach Zutaten gesucht wird, und werden im Daten-Backup auf der Profilseite
        mitgesichert.
      </p>
      <div class="field">
        <label for="own-food-search">Eigene Zutaten durchsuchen</label>
        <input id="own-food-search" type="text" autocomplete="off" placeholder="Name eingeben" />
      </div>
      <ul class="recipe-list__items" data-list></ul>
      <div class="profile-view__actions">
        <button type="button" class="button-secondary" data-action="add">+ Neue Zutat erfassen</button>
      </div>
    `

    const searchInput = container.querySelector<HTMLInputElement>('#own-food-search')!
    const listEl = container.querySelector<HTMLUListElement>('[data-list]')!

    function renderRows(foods: FoodItem[]): void {
      if (foods.length === 0) {
        listEl.innerHTML = '<li class="recipe-list__status">Keine eigenen Zutaten gefunden.</li>'
        return
      }
      listEl.innerHTML = foods
        .map(
          (food) => `
            <li>
              <button type="button" class="recipe-list__item" data-food-id="${food.id}">
                <span class="recipe-list__label">
                  <span class="recipe-list__name">${food.name.de}</span>
                </span>
                <span class="recipe-list__servings">${summarizeFood(food)}</span>
              </button>
            </li>`,
        )
        .join('')

      listEl.querySelectorAll<HTMLButtonElement>('[data-food-id]').forEach((button) => {
        button.addEventListener('click', () => {
          const foodId = button.dataset.foodId
          if (foodId) onSelectFood(foodId)
        })
      })
    }

    function applyFilter(): void {
      const allFoods = getCustomFoods()
      const query = searchInput.value.trim()
      const foods =
        query === ''
          ? [...allFoods].sort((a, b) => a.name.de.localeCompare(b.name.de, 'de'))
          : rankFoodsByQuery(allFoods, query)

      if (allFoods.length === 0) {
        listEl.innerHTML = '<li class="recipe-list__status">Noch keine eigenen Zutaten erfasst.</li>'
        return
      }
      renderRows(foods)
    }

    searchInput.addEventListener('input', applyFilter)
    applyFilter()

    container.querySelector('[data-action="add"]')?.addEventListener('click', () => {
      setMode({ type: 'create' })
    })
  }

  function renderCreate(): void {
    container.innerHTML = ''
    renderCustomFoodForm({
      container,
      existingFood: null,
      onSave: (input) => {
        upsertCustomFood(createCustomFood(input))
        setMode({ type: 'list' })
      },
      onCancel: () => setMode({ type: 'list' }),
    })
  }

  function render(): void {
    if (mode.type === 'list') renderList()
    else renderCreate()
  }

  render()
}
