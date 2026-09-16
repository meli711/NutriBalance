import type { UserProfile } from '../../data/models/userProfile.ts'
import { getFoodById } from '../../data/foodDatabaseService.ts'
import {
  getLogEntriesForDate,
  getMenuById,
  removeLogEntry,
  updateLogEntry,
} from '../../data/indexedDbService.ts'
import { getRequirementOverrides } from '../../data/localStorageService.ts'
import { getRecipeById } from '../recipes/recipeService.ts'
import { getRequirementsForProfile } from '../nutrient-requirements/requirementService.ts'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import { renderNutritionSummary } from '../nutrition-summary/nutritionSummaryView.ts'
import type { NutritionSummaryHandle } from '../nutrition-summary/nutritionSummaryView.ts'
import { calculateDailyNutrition } from './dailyNutritionService.ts'
import type { LogEntry } from './models/logEntry.ts'
import {
  addDaysToDateString,
  formatDateLabel,
  getLocalDateString,
  isFutureDateString,
} from '../../utils/date.ts'
import { formatNumber } from '../../utils/formatNumber.ts'

export interface DailyLogViewOptions {
  container: HTMLElement
  profile: UserProfile
  date: string
  onNavigateDate: (date: string) => void
  onAddEntry: () => void
}

let activeSummary: NutritionSummaryHandle | null = null

function destroyActiveSummary(): void {
  activeSummary?.destroy()
  activeSummary = null
}

function getRequirementsSafely(profile: UserProfile): NutrientRequirement[] {
  try {
    return getRequirementsForProfile(profile, getRequirementOverrides())
  } catch {
    return []
  }
}

interface ResolvedEntry {
  entry: LogEntry
  label: string
  missing: boolean
}

/** Löst einen Log-Eintrag für die Anzeige auf. `missing: true` = referenziertes Rezept/Menü/Zutat existiert nicht mehr (Instruktion 9, Edge Cases) — wird angezeigt statt abzustürzen. */
async function resolveEntry(entry: LogEntry): Promise<ResolvedEntry> {
  if (entry.type === 'food') {
    const food = await getFoodById(entry.foodId)
    return food
      ? { entry, label: `${food.name.de} — ${formatNumber(entry.amountGrams)} g`, missing: false }
      : { entry, label: 'Entfernte Zutat', missing: true }
  }
  if (entry.type === 'recipe') {
    const recipe = await getRecipeById(entry.recipeId)
    return recipe
      ? { entry, label: recipe.name, missing: false }
      : { entry, label: 'Entferntes Rezept', missing: true }
  }
  const menu = await getMenuById(entry.menuId)
  return menu
    ? { entry, label: `${menu.name} — ganzes Menü`, missing: false }
    : { entry, label: 'Entferntes Menü', missing: true }
}

export async function renderDailyLogView(options: DailyLogViewOptions): Promise<void> {
  const { container, profile, date, onNavigateDate, onAddEntry } = options
  destroyActiveSummary()

  container.innerHTML = `
    <section class="daily-log">
      <p class="recipe-list__status">Lade Tages-Log…</p>
    </section>
  `

  const entries = await getLogEntriesForDate(date)
  const resolved = await Promise.all(entries.map(resolveEntry))
  const isToday = date === getLocalDateString(new Date())

  const entryRows = resolved
    .map(({ entry, label, missing }) => {
      // Genau ein Zahlenfeld pro Zeile: bei `recipe` die Portionen (decken
      // "wie viel/wie oft" hier bereits vollständig ab), sonst der Faktor.
      const quantityInput =
        missing || entry.type === 'recipe'
          ? ''
          : `<input
              type="number"
              class="daily-log__qty-input"
              data-factor-input-id="${entry.id}"
              value="${entry.factor}"
              min="0"
              step="1"
              aria-label="Faktor (wie oft dieser Eintrag heute vorkommt)"
            />`
      const servingsInput =
        !missing && entry.type === 'recipe'
          ? `<input
              type="number"
              class="daily-log__qty-input"
              data-servings-input-id="${entry.id}"
              value="${entry.servings}"
              min="0"
              step="1"
              aria-label="Portionen"
            />`
          : ''

      return `
        <li class="menu-builder__ingredient-row daily-log__entry-row" data-entry-type="${entry.type}">
          ${servingsInput}${quantityInput}
          <span class="daily-log__type-dot" aria-hidden="true"></span>
          <span class="daily-log__entry-label">${missing ? `<em>${label}</em>` : label}</span>
          <button type="button" class="menu-list__delete" data-remove-entry-id="${entry.id}" aria-label="Eintrag entfernen">✕</button>
        </li>`
    })
    .join('')

  const bodyHtml =
    entries.length === 0
      ? `
        <p class="recipe-list__status">Für diesen Tag ist noch nichts erfasst.</p>
        <button type="button" class="button-primary" data-action="add">Eintrag hinzufügen</button>
      `
      : `
        <h2>Erfasste Einträge</h2>
        <ul class="menu-builder__ingredients">${entryRows}</ul>
        <button type="button" class="button-secondary" data-action="add">Weiteren Eintrag hinzufügen</button>

        <div data-summary-container></div>
      `

  container.innerHTML = `
    <section class="daily-log">
      <h1>Tages-Log</h1>

      <div class="daily-log__date-nav">
        <button type="button" class="daily-log__nav-btn" data-action="prev-day" aria-label="Vorheriger Tag">◀</button>
        <span class="daily-log__date-label">${formatDateLabel(date)}</span>
        <button
          type="button"
          class="daily-log__nav-btn"
          data-action="next-day"
          aria-label="Nächster Tag"
          ${isToday ? 'disabled' : ''}
        >▶</button>
      </div>

      ${bodyHtml}
    </section>
  `

  if (entries.length > 0) {
    const summaryContainer = container.querySelector<HTMLDivElement>('[data-summary-container]')
    if (summaryContainer) {
      const nutrientValues = await calculateDailyNutrition(date)
      const requirements = getRequirementsSafely(profile)
      activeSummary = renderNutritionSummary({
        container: summaryContainer,
        nutrientValues,
        requirements,
        profile,
        heading: 'Nährwerte (Tagessumme)',
      })
    }
  }

  container.querySelector('[data-action="prev-day"]')?.addEventListener('click', () => {
    destroyActiveSummary()
    onNavigateDate(addDaysToDateString(date, -1))
  })
  container.querySelector('[data-action="next-day"]')?.addEventListener('click', () => {
    const nextDate = addDaysToDateString(date, 1)
    if (isFutureDateString(nextDate)) return // Zukunft loggen ergibt fachlich keinen Sinn
    destroyActiveSummary()
    onNavigateDate(nextDate)
  })
  container.querySelector('[data-action="add"]')?.addEventListener('click', () => {
    destroyActiveSummary()
    onAddEntry()
  })

  container.querySelectorAll<HTMLButtonElement>('[data-remove-entry-id]').forEach((button) => {
    button.addEventListener('click', () => {
      void (async () => {
        const id = button.dataset.removeEntryId
        if (!id) return
        await removeLogEntry(id)
        destroyActiveSummary()
        // Neu rendern (auch für den Fall "letzter Eintrag entfernt" → sauber
        // zurück zum leeren Zustand, siehe Instruktion 9, Edge Cases).
        await renderDailyLogView(options)
      })()
    })
  })

  container.querySelectorAll<HTMLInputElement>('[data-factor-input-id]').forEach((input) => {
    input.addEventListener('change', () => {
      void (async () => {
        const id = input.dataset.factorInputId
        if (!id) return
        const current = resolved.find((r) => r.entry.id === id)?.entry
        if (!current) return

        const factor = Number(input.value)
        if (!Number.isFinite(factor) || factor <= 0) {
          window.alert('Bitte eine Zahl grösser als 0 eingeben.')
          input.value = String(current.factor)
          return
        }

        await updateLogEntry({ ...current, factor })
        destroyActiveSummary()
        await renderDailyLogView(options)
      })()
    })
  })

  container.querySelectorAll<HTMLInputElement>('[data-servings-input-id]').forEach((input) => {
    input.addEventListener('change', () => {
      void (async () => {
        const id = input.dataset.servingsInputId
        if (!id) return
        const current = resolved.find((r) => r.entry.id === id)?.entry
        if (!current || current.type !== 'recipe') return

        const servings = Number(input.value)
        if (!Number.isFinite(servings) || servings <= 0) {
          window.alert('Bitte eine Zahl grösser als 0 eingeben.')
          input.value = String(current.servings)
          return
        }

        await updateLogEntry({ ...current, servings })
        destroyActiveSummary()
        await renderDailyLogView(options)
      })()
    })
  })
}
