import type { UserProfile } from '../../data/models/userProfile.ts'
import {
  getHistorySettings,
  getRequirementOverrides,
  saveHistorySettings,
} from '../../data/localStorageService.ts'
import type { HistorySettings } from '../../data/localStorageService.ts'
import { getRequirementsForProfile } from '../nutrient-requirements/requirementService.ts'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import { NUTRIENT_LABELS } from '../../utils/nutrientLabels.ts'
import { getDateRange, getLocalDateString } from '../../utils/date.ts'
import { calculateNutritionHistory } from './historyNutritionService.ts'
import { renderHistoryChart } from './historyChart.ts'
import type { HistoryChartHandle } from './historyChart.ts'

export interface HistoryViewOptions {
  container: HTMLElement
  profile: UserProfile
  /** Wechsel ins heutige Tages-Log (aus dem leeren Zustand heraus). */
  onOpenLog: () => void
}

const PERIOD_DAYS: Record<HistorySettings['period'], number> = {
  week: 7,
  month: 30,
}

const PERIOD_LABELS: Record<HistorySettings['period'], string> = {
  week: 'Woche',
  month: 'Monat',
}

function getRequirementsSafely(profile: UserProfile): NutrientRequirement[] {
  try {
    return getRequirementsForProfile(profile, getRequirementOverrides())
  } catch {
    return []
  }
}

export function renderHistoryView(options: HistoryViewOptions): void {
  const { container, profile, onOpenLog } = options

  // Lokale, veränderbare Kopie der persistierten Einstellungen.
  const settings: HistorySettings = getHistorySettings()
  let activeChart: HistoryChartHandle | null = null

  function destroyActiveChart(): void {
    activeChart?.destroy()
    activeChart = null
  }

  function persist(): void {
    saveHistorySettings(settings)
  }

  container.innerHTML = `
    <section class="history">
      <h1>Verlauf</h1>
      <p class="history__intro">
        Wie sich deine tägliche Aufnahme über die Zeit entwickelt hat, im Vergleich zu deinem Bedarf.
      </p>

      <div class="nutrient-chart__toggle" role="group" aria-label="Zeitraum wählen" data-period-toggle>
        ${(['week', 'month'] as const)
          .map(
            (period) => `
              <button
                type="button"
                class="nutrient-chart__toggle-btn${period === settings.period ? ' is-active' : ''}"
                data-period="${period}"
                aria-pressed="${period === settings.period}"
              >${PERIOD_LABELS[period]}</button>`,
          )
          .join('')}
      </div>

      <div class="history__nutrients" role="group" aria-label="Nährstoffe für die Darstellung wählen" data-nutrient-toggle>
        ${Object.keys(NUTRIENT_LABELS)
          .map(
            (nutrientId) => `
              <button
                type="button"
                class="history__chip${settings.nutrientIds.includes(nutrientId) ? ' is-active' : ''}"
                data-nutrient="${nutrientId}"
                aria-pressed="${settings.nutrientIds.includes(nutrientId)}"
              >${NUTRIENT_LABELS[nutrientId]}</button>`,
          )
          .join('')}
      </div>

      <div data-charts>
        <p class="recipe-list__status">Lade Verlauf…</p>
      </div>
    </section>
  `

  const chartsSlot = container.querySelector<HTMLDivElement>('[data-charts]')

  function syncControlStates(): void {
    container.querySelectorAll<HTMLButtonElement>('[data-period]').forEach((button) => {
      const isActive = button.dataset.period === settings.period
      button.classList.toggle('is-active', isActive)
      button.setAttribute('aria-pressed', String(isActive))
    })
    const onlyOneLeft = settings.nutrientIds.length === 1
    container.querySelectorAll<HTMLButtonElement>('[data-nutrient]').forEach((button) => {
      const nutrientId = button.dataset.nutrient ?? ''
      const isActive = settings.nutrientIds.includes(nutrientId)
      button.classList.toggle('is-active', isActive)
      button.setAttribute('aria-pressed', String(isActive))
      // Den letzten aktiven Nährstoff nicht abwählbar machen — die Seite soll
      // nie ganz ohne Chart dastehen.
      button.disabled = isActive && onlyOneLeft
    })
  }

  async function refresh(): Promise<void> {
    if (!chartsSlot) return
    destroyActiveChart()
    chartsSlot.innerHTML = `<p class="recipe-list__status">Lade Verlauf…</p>`

    const dates = getDateRange(getLocalDateString(new Date()), PERIOD_DAYS[settings.period])
    const history = await calculateNutritionHistory(dates)
    const hasAnyEntry = [...history.values()].some((values) => values.length > 0)

    if (!hasAnyEntry) {
      chartsSlot.innerHTML = `
        <p class="recipe-list__status">Für diesen Zeitraum ist noch nichts im Tages-Log erfasst.</p>
        <button type="button" class="button-primary" data-action="open-log">Zum Tages-Log</button>
      `
      chartsSlot
        .querySelector('[data-action="open-log"]')
        ?.addEventListener('click', () => {
          destroyActiveChart()
          onOpenLog()
        })
      return
    }

    const requirements = getRequirementsSafely(profile)
    activeChart = renderHistoryChart({
      container: chartsSlot,
      dates,
      history,
      requirements,
      nutrientIds: settings.nutrientIds,
    })
  }

  container.querySelectorAll<HTMLButtonElement>('[data-period]').forEach((button) => {
    button.addEventListener('click', () => {
      const period = button.dataset.period as HistorySettings['period'] | undefined
      if (!period || period === settings.period) return
      settings.period = period
      persist()
      syncControlStates()
      void refresh()
    })
  })

  container.querySelectorAll<HTMLButtonElement>('[data-nutrient]').forEach((button) => {
    button.addEventListener('click', () => {
      const nutrientId = button.dataset.nutrient
      if (!nutrientId) return
      const isActive = settings.nutrientIds.includes(nutrientId)
      if (isActive) {
        if (settings.nutrientIds.length === 1) return // letzten aktiven nicht abwählen
        settings.nutrientIds = settings.nutrientIds.filter((id) => id !== nutrientId)
      } else {
        // Reihenfolge der Labels beibehalten, damit die Charts stabil sortiert sind.
        settings.nutrientIds = Object.keys(NUTRIENT_LABELS).filter(
          (id) => settings.nutrientIds.includes(id) || id === nutrientId,
        )
      }
      persist()
      syncControlStates()
      void refresh()
    })
  })

  syncControlStates()
  void refresh()
}
