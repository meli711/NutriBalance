import type { FoodItem } from '../../data/models/food.ts'
import {
  applyCustomFoodInput,
  createCustomFood,
  deleteCustomFood,
  getCustomFoods,
  upsertCustomFood,
} from '../../data/customFoodService.ts'
import { renderCustomFoodForm } from './customFoodForm.ts'
import { formatNumber } from '../../utils/formatNumber.ts'
import { buildFoodDeleteConfirmMessage, countFoodUsage } from '../shared/referenceUsageService.ts'

export interface CustomFoodsSectionOptions {
  /** Element, in das der Abschnitt angehängt wird (nicht ersetzt). */
  container: HTMLElement
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
 * Abschnitt "Eigene Zutaten" auf der Profilseite (Instruktion 13) — analog zu
 * `renderBackupSection` eine in sich geschlossene Komponente, die sich nach
 * jeder Änderung selbst neu rendert, statt die ganze Profilseite neu
 * aufzubauen. Erfasste Zutaten landen nur im `localStorage`
 * (`customFoodService.ts`) und fliessen über `foodDatabaseService.ts` in
 * Suche/Tages-Log/Menü-Builder/Rezepte ein, genau wie generische Einträge.
 */
export function renderCustomFoodsSection(options: CustomFoodsSectionOptions): void {
  const { container } = options

  const section = document.createElement('section')
  section.className = 'custom-foods-section'
  container.appendChild(section)

  let mode: { type: 'list' } | { type: 'form'; existingFood: FoodItem | null } = { type: 'list' }

  function setMode(next: typeof mode): void {
    mode = next
    render()
  }

  function renderList(): void {
    const foods = getCustomFoods()

    section.innerHTML = `
      <h2>Eigene Zutaten</h2>
      <p class="profile-view__meta">
        Zutaten, die in der Nährwertdatenbank fehlen, lassen sich hier selbst erfassen
        (nur Energie und Makronährstoffe). Sie stehen danach überall zur Auswahl, wo
        nach Zutaten gesucht wird, und werden im Daten-Backup unten mitgesichert.
      </p>
      <ul class="custom-foods__list" data-list></ul>
      <div class="profile-view__actions">
        <button type="button" class="button-secondary" data-action="add">+ Neue Zutat erfassen</button>
      </div>
    `

    const listEl = section.querySelector<HTMLUListElement>('[data-list]')!
    if (foods.length === 0) {
      listEl.innerHTML = '<li class="recipe-list__status">Noch keine eigenen Zutaten erfasst.</li>'
    } else {
      listEl.innerHTML = foods
        .map(
          (food) => `
            <li class="custom-foods__item">
              <div class="custom-foods__item-info">
                <span class="custom-foods__item-name">${food.name.de}</span>
                <span class="custom-foods__item-meta">${summarizeFood(food)}</span>
              </div>
              <div class="custom-foods__item-actions">
                <button type="button" class="button-secondary" data-edit-id="${food.id}">Bearbeiten</button>
                <button type="button" class="menu-list__delete-full" data-delete-id="${food.id}">Löschen</button>
              </div>
            </li>`,
        )
        .join('')
    }

    section.querySelector('[data-action="add"]')?.addEventListener('click', () => {
      setMode({ type: 'form', existingFood: null })
    })

    listEl.querySelectorAll<HTMLButtonElement>('[data-edit-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const food = foods.find((f) => f.id === button.dataset.editId)
        if (food) setMode({ type: 'form', existingFood: food })
      })
    })

    listEl.querySelectorAll<HTMLButtonElement>('[data-delete-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.deleteId
        if (!id) return
        const food = foods.find((f) => f.id === id)
        if (!food) return

        // Vor dem Löschen prüfen, ob die Zutat noch in Log-Einträgen/Menüs
        // verwendet wird — nach dem Löschen zeigen diese Stellen die Zutat
        // nur noch als "unbekannt"/"unvollständig" an (siehe
        // `referenceUsageService.ts`), daher die verschärfte Warnung.
        void countFoodUsage(id).then((usage) => {
          if (!window.confirm(buildFoodDeleteConfirmMessage(food.name.de, usage))) return
          deleteCustomFood(id)
          render()
        })
      })
    })
  }

  function renderForm(existingFood: FoodItem | null): void {
    section.innerHTML = `<h2>Eigene Zutaten</h2>`
    const formContainer = document.createElement('div')
    section.appendChild(formContainer)

    renderCustomFoodForm({
      container: formContainer,
      existingFood,
      onSave: (input) => {
        const food = existingFood ? applyCustomFoodInput(existingFood, input) : createCustomFood(input)
        upsertCustomFood(food)
        setMode({ type: 'list' })
      },
      onCancel: () => setMode({ type: 'list' }),
    })
  }

  function render(): void {
    if (mode.type === 'list') renderList()
    else renderForm(mode.existingFood)
  }

  render()
}
