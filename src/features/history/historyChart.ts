import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import type { NutrientValues } from '../recipes/models/nutritionValues.ts'
import {
  getEnergyRequirementKcal,
  resolveComparableTarget,
} from '../recipes/dailyRequirementPercentage.ts'
import { NUTRIENT_LABELS, UNIT_LABELS } from '../../utils/nutrientLabels.ts'
import { formatShortDateLabel } from '../../utils/date.ts'
import { formatNumber } from '../../utils/formatNumber.ts'

// Nur die für das Linien-Chart nötigen Chart.js-Bausteine registrieren (nicht
// das ganze Paket) — gleiche Begründung wie in `nutrientComparisonChart.ts`.
// Chart.register ist idempotent, daher unkritisch, dass beide Module registrieren.
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
)

export interface HistoryChartOptions {
  container: HTMLElement
  /** Die Tage des Zeitraums, aufsteigend (siehe `getDateRange`). */
  dates: string[]
  /** Aufnahme pro Tag, `date` → `NutrientValues` (leer = an dem Tag nichts geloggt). */
  history: Map<string, NutrientValues>
  /** Bedarf für das Profil, z.B. `getRequirementsForProfile(profile, overrides)`. */
  requirements: NutrientRequirement[]
  /** Welche Nährstoffe dargestellt werden — ein Chart pro Nährstoff. */
  nutrientIds: string[]
}

export interface HistoryChartHandle {
  destroy(): void
}

function readCssColor(varName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value || fallback
}

interface DayValue {
  value: number
  incomplete: boolean
}

function intakeFor(values: NutrientValues | undefined, nutrientId: string): DayValue {
  const amount = values?.find((v) => v.nutrientId === nutrientId)
  return { value: amount?.value ?? 0, incomplete: amount?.incomplete ?? false }
}

/**
 * Einheit für den Nährstoff. Bevorzugt aus der berechneten Aufnahme (die an
 * jedem Tag mit Einträgen alle Nährstoffe enthält), sonst aus dem
 * Referenzwert. Fällt beides weg (Zeitraum ganz ohne Einträge), bleibt sie
 * leer — dieser Fall wird schon in `historyView.ts` als "nichts geloggt"
 * abgefangen, bevor das Chart überhaupt gerendert wird.
 */
function resolveUnit(
  nutrientId: string,
  history: Map<string, NutrientValues>,
  requirement: NutrientRequirement | undefined,
): string {
  for (const values of history.values()) {
    const amount = values.find((v) => v.nutrientId === nutrientId)
    if (amount) return amount.unit
  }
  return requirement?.unit ?? ''
}

export function renderHistoryChart(options: HistoryChartOptions): HistoryChartHandle {
  const { container, dates, history, requirements, nutrientIds } = options

  const intakeColor = readCssColor('--chart-color-intake', '#0b8a6f')
  const intakeFill = readCssColor('--chart-color-intake-fill', 'rgba(11, 138, 111, 0.2)')
  const requirementColor = readCssColor('--chart-color-requirement', '#b5651d')
  const gridColor = readCssColor('--color-border', '#d8dbd0')
  const textColor = readCssColor('--color-text-muted', '#5b5d54')

  const isNarrow = window.matchMedia('(max-width: 480px)').matches
  const maxTicksLimit = isNarrow ? 4 : 8

  const requirementsById = new Map(requirements.map((r) => [r.nutrientId, r]))
  const energyKcal = getEnergyRequirementKcal(requirements)
  const labels = dates.map(formatShortDateLabel)

  container.innerHTML = `
    <div class="history-chart">
      ${nutrientIds
        .map(
          (nutrientId) => `
            <div class="history-chart__item" data-nutrient-id="${nutrientId}">
              <p class="history-chart__caption" data-caption></p>
              <div class="history-chart__canvas"><canvas></canvas></div>
              <div data-notes></div>
            </div>`,
        )
        .join('')}
    </div>
  `

  const charts: Chart[] = []

  container.querySelectorAll<HTMLDivElement>('[data-nutrient-id]').forEach((item) => {
    const nutrientId = item.dataset.nutrientId
    if (!nutrientId) return

    const requirement = requirementsById.get(nutrientId)
    const unit = resolveUnit(nutrientId, history, requirement)
    const unitLabel = UNIT_LABELS[unit] ?? unit
    const label = NUTRIENT_LABELS[nutrientId] ?? nutrientId

    const dayValues = dates.map((date) => intakeFor(history.get(date), nutrientId))
    const intakeSeries = dayValues.map((d) => Math.round(d.value * 100) / 100)
    const hasIncomplete = dayValues.some((d) => d.incomplete)

    const target = requirement
      ? resolveComparableTarget(requirement, unit, energyKcal)
      : null

    const caption = item.querySelector<HTMLParagraphElement>('[data-caption]')
    if (caption) {
      caption.innerHTML = `${label} <span>(${unitLabel})</span>`
    }

    const canvas = item.querySelector('canvas')
    if (canvas) {
      const intakeDataset = {
        label: 'Aufnahme',
        data: intakeSeries,
        borderColor: intakeColor,
        backgroundColor: intakeFill,
        pointBackgroundColor: intakeColor,
        pointRadius: 3,
        tension: 0.25,
        fill: true,
      }
      const requirementDataset =
        target !== null
          ? [
              {
                label: 'Bedarf',
                data: dates.map(() => Math.round(target * 100) / 100),
                borderColor: requirementColor,
                borderDash: [6, 4],
                pointRadius: 0,
                fill: false,
              },
            ]
          : []

      charts.push(
        new Chart(canvas, {
          type: 'line',
          data: { labels, datasets: [intakeDataset, ...requirementDataset] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: textColor, maxTicksLimit, autoSkip: true, maxRotation: 0 },
              },
              y: {
                beginAtZero: true,
                grid: { color: gridColor },
                ticks: { color: textColor },
              },
            },
            plugins: {
              legend: { position: 'bottom', labels: { color: textColor } },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${formatNumber(Number(ctx.parsed.y))} ${unitLabel}`,
                },
              },
            },
          },
        }),
      )
    }

    const notes = item.querySelector<HTMLDivElement>('[data-notes]')
    if (notes) {
      const parts: string[] = []
      if (target === null) {
        parts.push(
          'Für diesen Nährstoff ist für dein Profil kein direkter Vergleichswert hinterlegt.',
        )
      }
      if (hasIncomplete) {
        parts.push(
          'An Tagen mit fehlenden Datenbankwerten ist der angezeigte Wert eine Unterschätzung.',
        )
      }
      notes.innerHTML = parts.map((text) => `<p class="chart-note">${text}</p>`).join('')
    }
  })

  return {
    destroy() {
      charts.forEach((chart) => chart.destroy())
      charts.length = 0
    },
  }
}
