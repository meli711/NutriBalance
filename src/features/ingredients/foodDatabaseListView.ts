import { searchFoodsByName } from '../../data/foodDatabaseService.ts'
import type { FoodItem } from '../../data/models/food.ts'

export interface FoodDatabaseListOptions {
  container: HTMLElement
  onSelectFood: (foodId: string) => void
}

const MIN_QUERY_LENGTH = 2
const RESULT_LIMIT = 50

/**
 * Durchsuchbare Liste der gesamten Lebensmitteldatenbank (generisch +
 * Build-Zeit-Markenprodukte, Instruktion 12 + eigene Zutaten, Instruktion 13
 * — `searchFoodsByName` mischt das bereits zusammen). Anders als
 * `foodPickerControl.ts` (kompaktes Such-Dropdown zum Auswählen einer
 * Menge) ist dies eine volle Seite zum Durchstöbern — bei leerer Suche wird
 * deshalb **nicht** die ganze Datenbank (über 1000 Einträge) gerendert,
 * sondern ein Hinweis gezeigt.
 */
export function renderFoodDatabaseList(options: FoodDatabaseListOptions): void {
  const { container, onSelectFood } = options

  container.innerHTML = `
    <div class="field">
      <label for="ingredient-database-search">Zutat suchen</label>
      <input id="ingredient-database-search" type="text" autocomplete="off" placeholder="z.B. Haferflocken" />
    </div>
    <ul class="recipe-list__items" data-results></ul>
  `

  const input = container.querySelector<HTMLInputElement>('#ingredient-database-search')!
  const resultsEl = container.querySelector<HTMLUListElement>('[data-results]')!
  let requestId = 0

  function renderMessage(text: string): void {
    resultsEl.innerHTML = `<li class="recipe-list__status">${text}</li>`
  }

  function renderResults(foods: FoodItem[]): void {
    const topResults = foods.slice(0, RESULT_LIMIT)
    const remaining = foods.length - topResults.length

    resultsEl.innerHTML =
      topResults
        .map(
          (food) => `
            <li>
              <button type="button" class="recipe-list__item" data-food-id="${food.id}">
                <span class="recipe-list__name">${food.name.de}</span>
              </button>
            </li>`,
        )
        .join('') +
      (remaining > 0
        ? `<li class="recipe-list__status">+ ${remaining} weitere Treffer — bitte genauer suchen</li>`
        : '')

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-food-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const foodId = button.dataset.foodId
        if (foodId) onSelectFood(foodId)
      })
    })
  }

  function showMinLengthHint(): void {
    renderMessage(
      `Suchbegriff eingeben (mind. ${MIN_QUERY_LENGTH} Zeichen) — die Datenbank enthält über 1000 Einträge.`,
    )
  }

  input.addEventListener('input', () => {
    const query = input.value.trim()
    const currentRequestId = ++requestId

    if (query.length < MIN_QUERY_LENGTH) {
      showMinLengthHint()
      return
    }

    void searchFoodsByName(query).then((results) => {
      if (currentRequestId !== requestId) return // veraltete Antwort ignorieren
      if (results.length === 0) {
        renderMessage('Keine Treffer.')
        return
      }
      renderResults(results)
    })
  })

  showMinLengthHint()
}
