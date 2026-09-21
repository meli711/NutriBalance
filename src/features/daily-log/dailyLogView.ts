import type { UserProfile } from '../../data/models/userProfile.ts'
import type { FoodItem } from '../../data/models/food.ts'
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
import { calculateNovaGroup } from '../recipes/nutritionCalculator.ts'
import type { NovaSummary } from '../recipes/nutritionCalculator.ts'
import { NOVA_LABELS } from '../../utils/novaLabels.ts'
import { isMealCategory, renderMealCategoryIcon } from '../../utils/mealCategoryIcon.ts'
import type { MealCategory } from '../../utils/mealCategoryIcon.ts'
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
  /** Nova-Klassifikation dieses Eintrags (Instruktion 17), `null` bei `missing: true`. */
  nova: NovaSummary | null
  /** Kategorie-Icon des referenzierten Rezepts/Menüs (Instruktion 21) — `undefined` bei `food`-Einträgen (keine Kategorie) oder wenn keine gesetzt ist. */
  category?: MealCategory
}

/** Baut die `foodId → FoodItem`-Map für eine Zutatenliste, analog zu `recipeDetailView.ts`/`menuDetailView.ts`. */
async function buildFoodsById(ingredients: { foodId: string }[]): Promise<Map<string, FoodItem>> {
  const foods = await Promise.all(ingredients.map((ing) => getFoodById(ing.foodId)))
  const foodsById = new Map<string, FoodItem>()
  foods.forEach((food, index) => {
    if (food) foodsById.set(ingredients[index]!.foodId, food)
  })
  return foodsById
}

/** Löst einen Log-Eintrag für die Anzeige auf. `missing: true` = referenziertes Rezept/Menü/Zutat existiert nicht mehr (Instruktion 9, Edge Cases) — wird angezeigt statt abzustürzen. */
async function resolveEntry(entry: LogEntry): Promise<ResolvedEntry> {
  if (entry.type === 'food') {
    const food = await getFoodById(entry.foodId)
    if (!food) return { entry, label: 'Entfernte Zutat', missing: true, nova: null }
    const ingredients = [{ foodId: entry.foodId, amountGrams: entry.amountGrams }]
    const nova = calculateNovaGroup(ingredients, new Map([[food.id, food]]))
    return {
      entry,
      label: `${food.name.de} — ${formatNumber(entry.amountGrams)} g`,
      missing: false,
      nova,
    }
  }
  if (entry.type === 'recipe') {
    const recipe = await getRecipeById(entry.recipeId)
    if (!recipe) return { entry, label: 'Entferntes Rezept', missing: true, nova: null }
    const nova = calculateNovaGroup(recipe.ingredients, await buildFoodsById(recipe.ingredients))
    return { entry, label: recipe.name, missing: false, nova, category: recipe.category }
  }
  const menu = await getMenuById(entry.menuId)
  if (!menu) return { entry, label: 'Entferntes Menü', missing: true, nova: null }
  const nova = calculateNovaGroup(menu.ingredients, await buildFoodsById(menu.ingredients))
  return {
    entry,
    label: `${menu.name} — ganzes Menü`,
    missing: false,
    nova,
    category: menu.category,
  }
}

/** Höchste Nova-Gruppe über alle Einträge des Tages — Nova hängt nicht von Menge/Faktor ab, daher genügt das Maximum der bereits pro Eintrag berechneten Werte (kein eigener Weg über `sumDailyNutrition` nötig). */
function summarizeDayNova(resolved: ResolvedEntry[]): NovaSummary {
  let group: 1 | 2 | 3 | 4 | null = null
  let incomplete = false

  for (const { missing, nova } of resolved) {
    if (missing || !nova) {
      incomplete = true
      continue
    }
    if (nova.incomplete) incomplete = true
    if (nova.group !== null && (group === null || nova.group > group)) group = nova.group
  }

  return { group, incomplete }
}

function formatNovaTag(nova: NovaSummary): string {
  if (nova.group === null) {
    return `<span class="daily-log__nova-tag daily-log__nova-tag--unknown" title="Keine Nova-Gruppe hinterlegt.">–</span>`
  }
  const title = `Nova ${nova.group} – ${NOVA_LABELS[nova.group]}${nova.incomplete ? ' (mind. eine Zutat ohne Angabe)' : ''}`
  return `<span class="daily-log__nova-tag" title="${title}">N${nova.group}${nova.incomplete ? '*' : ''}</span>`
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
  const resolved = (await Promise.all(entries.map(resolveEntry))).sort((a, b) =>
    a.label.localeCompare(b.label, 'de'),
  )
  const isToday = date === getLocalDateString(new Date())

  const entryRows = resolved
    .map(({ entry, label, missing, nova, category }) => {
      // Genau ein Zahlenfeld pro Zeile: der Faktor — bei allen drei Typen
      // einheitlich (ein Rezept entspricht seit Instruktion 19 immer genau
      // einer Portion, hat also keine eigene, zusätzliche Mengenangabe mehr).
      const quantityInput = missing
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

      return `
        <li class="menu-builder__ingredient-row daily-log__entry-row" data-entry-type="${entry.type}">
          ${quantityInput}
          <span class="daily-log__type-dot" aria-hidden="true"></span>
          ${!missing && category && isMealCategory(category) ? `<span class="recipe-list__icon">${renderMealCategoryIcon(category)}</span>` : ''}
          <span class="daily-log__entry-label">${missing ? `<em>${label}</em>` : label}</span>
          ${missing || !nova ? '' : formatNovaTag(nova)}
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
        novaGroup: summarizeDayNova(resolved),
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
}
