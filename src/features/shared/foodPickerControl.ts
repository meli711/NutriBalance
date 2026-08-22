import type { FoodItem } from '../../data/models/food.ts'
import { searchFoodsByName } from '../../data/foodDatabaseService.ts'

/**
 * Gemeinsame "Zutat suchen + Menge angeben"-Kontrolle, genutzt vom
 * Menü-Builder (Instruktion 6) UND dem Tages-Log (Instruktion 9) — beide
 * brauchten exakt dasselbe Muster (Suche mit Live-Dropdown, Menge in Gramm,
 * Hinzufügen-Button). Als eigene Komponente extrahiert, statt zu
 * duplizieren, u.a. weil hier bereits einmal ein Bug (nur 8 Suchtreffer
 * angezeigt) gefixt werden musste — der sonst an zwei Stellen gepflegt
 * werden müsste.
 */
export interface FoodPickerOptions {
  container: HTMLElement
  onAdd: (food: FoodItem, amountGrams: number) => void
  addButtonLabel?: string
}

const SUGGESTION_LIMIT = 50

export function renderFoodPicker(options: FoodPickerOptions): void {
  const { container, onAdd, addButtonLabel = 'Hinzufügen' } = options

  container.innerHTML = `
    <div class="field menu-builder__search-field">
      <label for="food-picker-search">Zutat suchen</label>
      <input id="food-picker-search" type="text" autocomplete="off" placeholder="z.B. Haferflocken" />
      <ul class="menu-builder__suggestions" data-suggestions hidden></ul>
    </div>

    <div class="menu-builder__add-row" data-add-row hidden>
      <p class="menu-builder__selected" data-selected-food></p>
      <div class="field">
        <label for="food-picker-amount">Menge (g)</label>
        <input id="food-picker-amount" type="number" min="1" value="100" />
      </div>
      <button type="button" class="button-primary" data-action="add">${addButtonLabel}</button>
    </div>

    <p class="field-error" role="alert" hidden data-error></p>
  `

  const searchInput = container.querySelector<HTMLInputElement>('#food-picker-search')!
  const suggestionsList = container.querySelector<HTMLUListElement>('[data-suggestions]')!
  const addRow = container.querySelector<HTMLDivElement>('[data-add-row]')!
  const selectedFoodLabel = container.querySelector<HTMLParagraphElement>('[data-selected-food]')!
  const amountInput = container.querySelector<HTMLInputElement>('#food-picker-amount')!
  const errorEl = container.querySelector<HTMLParagraphElement>('[data-error]')!

  let selectedFood: FoodItem | null = null
  let searchRequestId = 0

  function hideSuggestions(): void {
    suggestionsList.hidden = true
    suggestionsList.innerHTML = ''
  }

  function resetSelection(): void {
    selectedFood = null
    addRow.hidden = true
    amountInput.value = '100'
  }

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim()
    const requestId = ++searchRequestId
    resetSelection()
    errorEl.hidden = true

    if (query.length < 2) {
      hideSuggestions()
      return
    }

    void searchFoodsByName(query).then((results) => {
      if (requestId !== searchRequestId) return // veraltete Antwort ignorieren

      if (results.length === 0) {
        suggestionsList.innerHTML = '<li class="menu-builder__suggestion-empty">Keine Treffer</li>'
        suggestionsList.hidden = false
        return
      }

      // Grosszügiges Limit statt nur die ersten paar Treffer — bei
      // allgemeinen Suchbegriffen (z.B. "Milch": 44 Treffer) sonst wichtige
      // Ergebnisse (Vollmilch/Magermilch) unsichtbar, siehe Fix in Instruktion 6.
      const topResults = results.slice(0, SUGGESTION_LIMIT)
      const remaining = results.length - topResults.length

      suggestionsList.innerHTML =
        topResults
          .map(
            (food) =>
              `<li><button type="button" data-food-id="${food.id}">${food.name.de}</button></li>`,
          )
          .join('') +
        (remaining > 0
          ? `<li class="menu-builder__suggestion-empty">+ ${remaining} weitere Treffer — bitte genauer suchen</li>`
          : '')
      suggestionsList.hidden = false

      suggestionsList.querySelectorAll<HTMLButtonElement>('[data-food-id]').forEach((button) => {
        button.addEventListener('click', () => {
          const food = topResults.find((f) => f.id === button.dataset.foodId)
          if (!food) return
          selectedFood = food
          selectedFoodLabel.textContent = `Ausgewählt: ${food.name.de}`
          addRow.hidden = false
          hideSuggestions()
          searchInput.value = food.name.de
        })
      })
    })
  })

  container.querySelector('[data-action="add"]')?.addEventListener('click', () => {
    if (!selectedFood) return
    const amount = Number(amountInput.value)
    if (!Number.isFinite(amount) || amount <= 0) {
      errorEl.textContent = 'Bitte eine Menge grösser als 0g eingeben.'
      errorEl.hidden = false
      return
    }
    errorEl.hidden = true

    const food = selectedFood
    resetSelection()
    searchInput.value = ''

    onAdd(food, amount)
  })
}
