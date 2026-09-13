import type { CustomFoodInput } from '../../data/customFoodService.ts'
import type { FoodItem } from '../../data/models/food.ts'

export interface CustomFoodFormOptions {
  container: HTMLElement
  /** `null` = neue Zutat erfassen, sonst wird das Formular vorbefüllt (Bearbeiten). */
  existingFood: FoodItem | null
  onSave: (input: CustomFoodInput) => void
  onCancel: () => void
}

/**
 * Nur Energie + Makronährstoffe sind erfassbar — für Vitamine/Mineralstoffe
 * fehlt bei einer Hand-Erfassung schlicht eine verlässliche Grundlage (siehe
 * `customFoodService.ts`, `emptyVitamins`/`emptyMinerals`). Alle Nährwert-
 * felder sind optional (leer = `null`, nicht geraten) — nur der Name ist
 * Pflicht, sonst liesse sich die Zutat später nicht wiederfinden.
 */
const NUTRIENT_FIELDS: { key: keyof CustomFoodInput; label: string; unit: string }[] = [
  { key: 'energyKcal', label: 'Energie', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'fat', label: 'Fett', unit: 'g' },
  { key: 'saturatedFat', label: 'davon gesättigte Fettsäuren', unit: 'g' },
  { key: 'carbohydrates', label: 'Kohlenhydrate', unit: 'g' },
  { key: 'sugar', label: 'davon Zucker', unit: 'g' },
  { key: 'fiber', label: 'Ballaststoffe', unit: 'g' },
]

function parseOptionalNumber(input: HTMLInputElement): number | null {
  if (input.value.trim() === '') return null
  return input.valueAsNumber
}

export function renderCustomFoodForm(options: CustomFoodFormOptions): void {
  const { container, existingFood, onSave, onCancel } = options

  const values: Record<string, number | null> = existingFood
    ? {
        energyKcal: existingFood.energyKcal,
        protein: existingFood.protein,
        fat: existingFood.fat,
        saturatedFat: existingFood.saturatedFat,
        carbohydrates: existingFood.carbohydrates,
        sugar: existingFood.sugar,
        fiber: existingFood.fiber,
      }
    : {}

  container.innerHTML = `
    <form class="custom-food-form" novalidate>
      <h3>${existingFood ? 'Eigene Zutat bearbeiten' : 'Neue eigene Zutat erfassen'}</h3>

      <div class="field">
        <label for="custom-food-name">Name</label>
        <input
          id="custom-food-name"
          name="name"
          type="text"
          required
          value="${existingFood?.name.de ?? ''}"
        />
      </div>

      <div class="field">
        <label for="custom-food-category">Kategorie (optional)</label>
        <input
          id="custom-food-category"
          name="category"
          type="text"
          placeholder="z.B. Eigene Zutaten"
          value="${existingFood?.category ?? ''}"
        />
      </div>

      <p class="custom-food-form__hint">
        Werte jeweils pro 100 g — Felder leer lassen, wenn unbekannt (wird als
        "nicht angegeben" statt als 0 behandelt).
      </p>

      ${NUTRIENT_FIELDS.map(
        ({ key, label, unit }) => `
        <div class="field">
          <label for="custom-food-${key}">${label} (${unit})</label>
          <input
            id="custom-food-${key}"
            name="${key}"
            type="number"
            inputmode="decimal"
            step="any"
            min="0"
            value="${values[key] ?? ''}"
          />
        </div>`,
      ).join('')}

      <p class="field-error" role="alert" hidden></p>

      <div class="profile-view__actions">
        <button type="submit" class="button-primary">Speichern</button>
        <button type="button" class="button-secondary" data-action="cancel">Abbrechen</button>
      </div>
    </form>
  `

  const form = container.querySelector<HTMLFormElement>('.custom-food-form')
  const errorEl = container.querySelector<HTMLParagraphElement>('.field-error')
  if (!form || !errorEl) return

  form.addEventListener('submit', (event) => {
    event.preventDefault()

    const nameInput = form.querySelector<HTMLInputElement>('#custom-food-name')!
    const categoryInput = form.querySelector<HTMLInputElement>('#custom-food-category')!
    const name = nameInput.value.trim()

    if (!name) {
      errorEl.textContent = 'Bitte einen Namen für die Zutat eingeben.'
      errorEl.hidden = false
      return
    }

    for (const { key, label } of NUTRIENT_FIELDS) {
      const input = form.querySelector<HTMLInputElement>(`#custom-food-${key}`)!
      if (input.value.trim() !== '' && (!Number.isFinite(input.valueAsNumber) || input.valueAsNumber < 0)) {
        errorEl.textContent = `Bitte bei "${label}" eine Zahl grösser oder gleich 0 eingeben, oder das Feld leer lassen.`
        errorEl.hidden = false
        return
      }
    }

    errorEl.hidden = true
    errorEl.textContent = ''

    const input: CustomFoodInput = {
      name,
      category: categoryInput.value,
      energyKcal: parseOptionalNumber(form.querySelector('#custom-food-energyKcal')!),
      protein: parseOptionalNumber(form.querySelector('#custom-food-protein')!),
      fat: parseOptionalNumber(form.querySelector('#custom-food-fat')!),
      saturatedFat: parseOptionalNumber(form.querySelector('#custom-food-saturatedFat')!),
      carbohydrates: parseOptionalNumber(form.querySelector('#custom-food-carbohydrates')!),
      sugar: parseOptionalNumber(form.querySelector('#custom-food-sugar')!),
      fiber: parseOptionalNumber(form.querySelector('#custom-food-fiber')!),
    }

    onSave(input)
  })

  form.querySelector('[data-action="cancel"]')?.addEventListener('click', onCancel)
}
