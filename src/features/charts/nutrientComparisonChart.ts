import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
} from 'chart.js'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import type { NutrientValues } from '../recipes/models/nutritionValues.ts'
import {
  calculateDailyRequirementPercentage,
  getEnergyRequirementKcal,
  resolveComparableTarget,
} from '../recipes/dailyRequirementPercentage.ts'
import { NUTRIENT_LABELS, UNIT_LABELS } from '../../utils/nutrientLabels.ts'

// Nur die tatsächlich gebrauchten Chart.js-Bausteine registrieren (Radar +
// Balken), nicht das komplette Paket importieren — hält das Bundle klein.
Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  BarController,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
)

/**
 * Kernauswahl fürs Chart (Instruktion 5, Punkt 3): die 4 Makronährstoffe
 * (Protein/Fett/Kohlenhydrate/Ballaststoffe, wie im Auftrag als Beispiel
 * genannt — Energie bewusst nicht mit im Radar, da sie durch die Makros
 * bereits bestimmt ist und als eigene Kennzahl in der Tabelle steht) plus
 * 3 Mikronährstoffe: Calcium, Eisen, Vitamin C.
 *
 * Begründung für genau diese drei Mikronährstoffe (Datenverfügbarkeit vs.
 * fachliche Relevanz):
 * - Fachlich relevant: Calcium (Knochengesundheit), Eisen (häufiger
 *   Mangel, v.a. bei Frauen — DACH-Wert ist entsprechend gestaffelt),
 *   Vitamin C (immunrelevant, weit bekannt).
 * - Datenverfügbarkeit: in der Schweizer Nährwertdatenbank haben alle drei
 *   bei über 90% der Lebensmittel einen Wert (kein `k.A.`) — deutlich besser
 *   als z.B. Selen (70.5%) oder Jod (92.4%, aber fachlich stark
 *   jodierungsabhängig und daher schwerer allgemein zu interpretieren).
 */
export const CORE_NUTRIENT_IDS = [
  'protein',
  'fat',
  'carbohydrates',
  'fiber',
  'calcium',
  'iron',
  'vitaminC',
]

export interface NutrientComparisonChartOptions {
  container: HTMLElement
  /** Berechnete Aufnahme, z.B. `calculatePerServing(recipe, foods)` — nicht an "ein Rezept" gebunden. */
  intake: NutrientValues
  /** Bedarf für ein Profil, z.B. `getRequirementsForProfile(profile)`. */
  requirements: NutrientRequirement[]
  /** Überschreibt die Kernauswahl (Standard: `CORE_NUTRIENT_IDS`). */
  nutrientIds?: string[]
}

export interface NutrientComparisonChartHandle {
  destroy(): void
}

interface IncludedNutrient {
  nutrientId: string
  label: string
  unit: string
  intakeValue: number
  targetValue: number
  percentage: number
}

interface ExcludedNutrient {
  nutrientId: string
  reason: 'incomplete' | 'no-comparison'
}

const EXCLUSION_REASON_LABELS: Record<ExcludedNutrient['reason'], string> = {
  incomplete: 'fehlender Datenbankwert bei mindestens einer Zutat',
  'no-comparison': 'kein vergleichbarer Referenzwert für dieses Profil',
}

/**
 * Wählt aus `nutrientIds` diejenigen aus, die sich sauber darstellen lassen.
 * Nährstoffe mit `incomplete: true` (Instruktion 4) oder ohne vergleichbaren
 * Referenzwert (Instruktion 4, `dailyRequirementPercentage.ts`) werden NICHT
 * als 0%/0 dargestellt, sondern ausgeschlossen und separat aufgeführt.
 */
function selectIncludedNutrients(
  nutrientIds: string[],
  intake: NutrientValues,
  requirements: NutrientRequirement[],
): { included: IncludedNutrient[]; excluded: ExcludedNutrient[] } {
  const intakeById = new Map(intake.map((amount) => [amount.nutrientId, amount]))
  const requirementsById = new Map(requirements.map((r) => [r.nutrientId, r]))
  const percentages = calculateDailyRequirementPercentage(intake, requirements)
  const energyTargetKcal = getEnergyRequirementKcal(requirements)

  const included: IncludedNutrient[] = []
  const excluded: ExcludedNutrient[] = []

  for (const nutrientId of nutrientIds) {
    const amount = intakeById.get(nutrientId)
    if (!amount) continue // wird für diese Aufnahme gar nicht berechnet

    if (amount.incomplete) {
      excluded.push({ nutrientId, reason: 'incomplete' })
      continue
    }

    const requirement = requirementsById.get(nutrientId)
    const percentage = percentages.get(nutrientId) ?? null
    const target = requirement
      ? resolveComparableTarget(requirement, amount.unit, energyTargetKcal)
      : null

    if (!requirement || percentage === null || target === null) {
      excluded.push({ nutrientId, reason: 'no-comparison' })
      continue
    }

    included.push({
      nutrientId,
      label: NUTRIENT_LABELS[nutrientId] ?? nutrientId,
      unit: UNIT_LABELS[amount.unit] ?? amount.unit,
      intakeValue: amount.value,
      targetValue: target,
      percentage,
    })
  }

  return { included, excluded }
}

function readCssColor(varName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value || fallback
}

function buildExclusionNote(excluded: ExcludedNutrient[]): string {
  if (excluded.length === 0) return ''
  const byReason = new Map<ExcludedNutrient['reason'], string[]>()
  for (const item of excluded) {
    const label = NUTRIENT_LABELS[item.nutrientId] ?? item.nutrientId
    const list = byReason.get(item.reason) ?? []
    list.push(label)
    byReason.set(item.reason, list)
  }
  const parts = [...byReason.entries()].map(
    ([reason, labels]) => `${labels.join(', ')} (${EXCLUSION_REASON_LABELS[reason]})`,
  )
  return `<p class="chart-note">Nicht dargestellt: ${parts.join('; ')}.</p>`
}

export function renderNutrientComparisonChart(
  options: NutrientComparisonChartOptions,
): NutrientComparisonChartHandle {
  const { container, intake, requirements, nutrientIds = CORE_NUTRIENT_IDS } = options
  const { included, excluded } = selectIncludedNutrients(nutrientIds, intake, requirements)

  if (included.length === 0) {
    container.innerHTML = `<p class="chart-note">Für dieses Rezept/Profil lässt sich aktuell kein Chart darstellen (${
      excluded.length > 0
        ? 'keine vergleichbaren Referenzwerte oder fehlende Datenbankwerte'
        : 'keine passenden Nährstoffe'
    }).</p>`
    return { destroy() {} }
  }

  const intakeColor = readCssColor('--chart-color-intake', '#009688')
  const intakeFill = readCssColor('--chart-color-intake-fill', 'rgba(0, 150, 136, 0.2)')
  const requirementColor = readCssColor('--chart-color-requirement', '#b5651d')
  const requirementFill = readCssColor('--chart-color-requirement-fill', 'rgba(181, 101, 29, 0.15)')
  const gridColor = readCssColor('--color-border', '#e0e0e0')
  const textColor = readCssColor('--color-text-muted', '#5f5f5f')

  container.innerHTML = `
    <div class="nutrient-chart">
      <div class="nutrient-chart__toggle" role="group" aria-label="Chart-Ansicht wählen">
        <button type="button" class="nutrient-chart__toggle-btn is-active" data-view="radar" aria-pressed="true">Radar (%)</button>
        <button type="button" class="nutrient-chart__toggle-btn" data-view="bars" aria-pressed="false">Balken (absolut)</button>
      </div>
      <div class="nutrient-chart__view" data-view-panel="radar">
        <canvas></canvas>
      </div>
      <div class="nutrient-chart__view nutrient-chart__bars" data-view-panel="bars" hidden></div>
      ${buildExclusionNote(excluded)}
    </div>
  `

  const isNarrow = window.matchMedia('(max-width: 480px)').matches
  const pointLabelFontSize = isNarrow ? 10 : 12

  const radarCanvas = container.querySelector('canvas')
  if (!radarCanvas) return { destroy() {} }

  const suggestedMax = Math.max(120, ...included.map((n) => n.percentage))

  const radarChart = new Chart(radarCanvas, {
    type: 'radar',
    data: {
      labels: included.map((n) => n.label),
      datasets: [
        {
          label: 'Bedarf (100%)',
          data: included.map(() => 100),
          borderColor: requirementColor,
          backgroundColor: requirementFill,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: true,
        },
        {
          label: 'Aufnahme',
          data: included.map((n) => Math.round(n.percentage * 10) / 10),
          borderColor: intakeColor,
          backgroundColor: intakeFill,
          pointBackgroundColor: intakeColor,
          pointRadius: 4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          suggestedMax,
          grid: { color: gridColor },
          angleLines: { color: gridColor },
          pointLabels: { color: textColor, font: { size: pointLabelFontSize } },
          ticks: {
            color: textColor,
            backdropColor: 'transparent',
            callback: (value) => `${value}%`,
          },
        },
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue}%`,
          },
        },
      },
    },
  })

  let barCharts: Chart[] = []
  const barsPanel = container.querySelector<HTMLDivElement>('[data-view-panel="bars"]')

  function ensureBarCharts(): void {
    if (barCharts.length > 0 || !barsPanel) return

    barsPanel.innerHTML = included
      .map(
        (n) => `
          <div class="nutrient-chart__bar-item">
            <p class="nutrient-chart__bar-caption">${n.label} <span>(${n.unit})</span></p>
            <div class="nutrient-chart__bar-canvas"><canvas></canvas></div>
          </div>`,
      )
      .join('')

    const canvases = barsPanel.querySelectorAll('canvas')
    included.forEach((n, index) => {
      const canvas = canvases[index]
      if (!canvas) return
      barCharts.push(
        new Chart(canvas, {
          type: 'bar',
          data: {
            labels: ['Bedarf', 'Aufnahme'],
            datasets: [
              {
                data: [n.targetValue, n.intakeValue],
                backgroundColor: [requirementColor, intakeColor],
                borderRadius: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: textColor } },
              y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
            },
          },
        }),
      )
    })
  }

  const toggleButtons = container.querySelectorAll<HTMLButtonElement>('.nutrient-chart__toggle-btn')
  const radarPanel = container.querySelector<HTMLDivElement>('[data-view-panel="radar"]')

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.view
      toggleButtons.forEach((b) => {
        b.classList.toggle('is-active', b === button)
        b.setAttribute('aria-pressed', String(b === button))
      })
      if (view === 'bars') {
        ensureBarCharts()
        radarPanel?.setAttribute('hidden', '')
        barsPanel?.removeAttribute('hidden')
      } else {
        barsPanel?.setAttribute('hidden', '')
        radarPanel?.removeAttribute('hidden')
      }
    })
  })

  return {
    destroy() {
      radarChart.destroy()
      barCharts.forEach((chart) => chart.destroy())
      barCharts = []
    },
  }
}
