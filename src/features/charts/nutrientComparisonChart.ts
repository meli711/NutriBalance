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
 *
 * Ergänzt um Vitamin B12 und Folat (Instruktion 23):
 * - Fachlich zentral: B12 ist v.a. bei vegetarischer/veganer Ernährung
 *   kritisch (kommt fast nur in tierischen Lebensmitteln vor), Folat ist
 *   für Zellteilung und Blutbildung wichtig und v.a. in Gemüse und
 *   Hülsenfrüchten enthalten — zusammen decken die beiden also sowohl die
 *   tierische als auch die pflanzliche Seite ab.
 * - Datenverfügbarkeit: B12 bei 97.5 %, Folat bei 96.5 % der Lebensmittel
 *   mit Wert — sogar besser als Vitamin C (90.1 %).
 */
export const CORE_NUTRIENT_IDS = [
  'protein',
  'fat',
  'carbohydrates',
  'fiber',
  'calcium',
  'iron',
  'vitaminC',
  'vitaminB12',
  'folate',
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
  /**
   * `true`, wenn `value`/`percentage` eine Unterschätzung sind, weil für
   * mindestens eine Zutat kein Datenbankwert vorlag (siehe
   * `NutrientAmount.incomplete`). Anders als früher wird das NICHT mehr aus
   * dem Chart ausgeschlossen, sondern wie in der Nährwerttabelle
   * (`nutritionSummaryView.ts`) mit einem "*" markiert — sonst verschwinden
   * bei eigenen Zutaten (die nie Mikronährstoffe liefern) fast immer
   * Calcium/Eisen/Vitamin C aus dem Chart, obwohl ihr Wert aus den übrigen,
   * bekannten Zutaten meist noch aussagekräftig ist.
   */
  incomplete: boolean
}

interface ExcludedNutrient {
  nutrientId: string
  reason: 'no-comparison'
}

const EXCLUSION_REASON_LABELS: Record<ExcludedNutrient['reason'], string> = {
  'no-comparison': 'kein vergleichbarer Referenzwert für dieses Profil',
}

/**
 * Wählt aus `nutrientIds` diejenigen aus, die sich sauber darstellen lassen.
 * Nur Nährstoffe ganz ohne vergleichbaren Referenzwert (Instruktion 4,
 * `dailyRequirementPercentage.ts`) werden ausgeschlossen und separat
 * aufgeführt — Nährstoffe mit `incomplete: true` (fehlender Datenbankwert bei
 * mindestens einer Zutat) werden mit ihrem tatsächlich berechneten
 * (Unterschätzungs-)Wert dargestellt, markiert mit "*" (siehe `incomplete`
 * oben), genau wie in der Nährwerttabelle.
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
      incomplete: amount.incomplete,
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

function buildIncompleteNote(included: IncludedNutrient[]): string {
  if (!included.some((n) => n.incomplete)) return ''
  return `<p class="chart-note">* Für mindestens eine Zutat fehlt in der Datenbank ein Wert für diesen Nährstoff — die Angabe ist eine Schätzung.</p>`
}

function chartLabel(nutrient: IncludedNutrient): string {
  return nutrient.incomplete ? `${nutrient.label} *` : nutrient.label
}

export function renderNutrientComparisonChart(
  options: NutrientComparisonChartOptions,
): NutrientComparisonChartHandle {
  const { container, intake, requirements, nutrientIds = CORE_NUTRIENT_IDS } = options
  const { included, excluded } = selectIncludedNutrients(nutrientIds, intake, requirements)

  if (included.length === 0) {
    container.innerHTML = `<p class="chart-note">Für dieses Rezept/Profil lässt sich aktuell kein Chart darstellen (${
      excluded.length > 0
        ? 'keine vergleichbaren Referenzwerte für dieses Profil'
        : 'keine passenden Nährstoffe'
    }).</p>`
    return { destroy() {} }
  }

  // Ein Radar mit nur 1-2 Achsen entartet zu einer Linie/einem Punkt statt
  // einer sinnvollen Fläche (z.B. bei eigenen Zutaten, die nur Makros liefern
  // und denen zusätzlich noch ein Makro-Wert fehlt) — dann direkt auf die
  // Balken-Ansicht ausweichen statt einen kaputt wirkenden Radar zu zeigen.
  const canShowRadar = included.length >= 3

  const intakeColor = readCssColor('--chart-color-intake', '#009688')
  const intakeFill = readCssColor('--chart-color-intake-fill', 'rgba(0, 150, 136, 0.2)')
  const requirementColor = readCssColor('--chart-color-requirement', '#b5651d')
  const requirementFill = readCssColor('--chart-color-requirement-fill', 'rgba(181, 101, 29, 0.15)')
  const gridColor = readCssColor('--color-border', '#e0e0e0')
  const textColor = readCssColor('--color-text-muted', '#5f5f5f')

  const radarNote = canShowRadar
    ? ''
    : `<p class="chart-note">Zu wenige vergleichbare Nährstoffe (${included.length}) für eine sinnvolle Radar-Ansicht — es wird die Balken-Ansicht angezeigt.</p>`

  container.innerHTML = `
    <div class="nutrient-chart">
      ${
        canShowRadar
          ? `<div class="nutrient-chart__toggle" role="group" aria-label="Chart-Ansicht wählen">
        <button type="button" class="nutrient-chart__toggle-btn is-active" data-view="radar" aria-pressed="true">Radar (%)</button>
        <button type="button" class="nutrient-chart__toggle-btn" data-view="bars" aria-pressed="false">Balken (absolut)</button>
      </div>`
          : ''
      }
      <div class="nutrient-chart__view" data-view-panel="radar" ${canShowRadar ? '' : 'hidden'}>
        <canvas></canvas>
      </div>
      <div class="nutrient-chart__view nutrient-chart__bars" data-view-panel="bars" ${canShowRadar ? 'hidden' : ''}></div>
      ${radarNote}
      ${buildExclusionNote(excluded)}
      ${buildIncompleteNote(included)}
    </div>
  `

  const isNarrow = window.matchMedia('(max-width: 480px)').matches
  const pointLabelFontSize = isNarrow ? 10 : 12

  let radarChart: Chart | null = null

  if (canShowRadar) {
    const radarCanvas = container.querySelector('canvas')
    if (!radarCanvas) return { destroy() {} }

    const suggestedMax = Math.max(120, ...included.map((n) => n.percentage))

    radarChart = new Chart(radarCanvas, {
      type: 'radar',
      data: {
        labels: included.map((n) => chartLabel(n)),
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
              // Feste Anzahl statt automatischer Schrittweite: sonst
              // erzeugt ein hoher `suggestedMax` (z.B. wenn wegen
              // fehlender Werte nur noch wenige, dafür stärker
              // ausschlagende Nährstoffe übrig bleiben) zu viele Ringe,
              // deren Beschriftungen sich Richtung erster Achse überlappen.
              count: 5,
              callback: (value) => `${Math.round(Number(value))}%`,
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
  }

  let barCharts: Chart[] = []
  const barsPanel = container.querySelector<HTMLDivElement>('[data-view-panel="bars"]')

  function ensureBarCharts(): void {
    if (barCharts.length > 0 || !barsPanel) return

    barsPanel.innerHTML = included
      .map(
        (n) => `
          <div class="nutrient-chart__bar-item">
            <p class="nutrient-chart__bar-caption">${chartLabel(n)} <span>(${n.unit})</span></p>
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

  if (!canShowRadar) {
    // Keine Umschalt-Buttons in diesem Fall (siehe Markup oben) — Balken sind
    // die einzige Ansicht und müssen direkt aufgebaut werden.
    ensureBarCharts()
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
      radarChart?.destroy()
      barCharts.forEach((chart) => chart.destroy())
      barCharts = []
    },
  }
}
