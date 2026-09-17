import type { UserProfile } from '../../data/models/userProfile.ts'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import type { NutrientValues } from '../recipes/models/nutritionValues.ts'
import type { NovaSummary } from '../recipes/nutritionCalculator.ts'
import { calculateDailyRequirementPercentage } from '../recipes/dailyRequirementPercentage.ts'
import { NUTRIENT_LABELS, UNIT_LABELS } from '../../utils/nutrientLabels.ts'
import { NOVA_LABELS } from '../../utils/novaLabels.ts'
import { formatNumber } from '../../utils/formatNumber.ts'
import { renderNutrientComparisonChart } from '../charts/nutrientComparisonChart.ts'
import type { NutrientComparisonChartHandle } from '../charts/nutrientComparisonChart.ts'

/**
 * Gemeinsame Anzeige "Bedarf vs. Aufnahme"-Chart + Nährwerttabelle inkl.
 * %-Bedarf-Spalte, von `recipeDetailView.ts`, `menuDetailView.ts` UND
 * `menuBuilderView.ts` (Live-Vorschau) genutzt (Instruktion 6, Punkt 3c) —
 * damit dieselbe Logik nicht dreimal existiert. Die Zutatenliste selbst
 * (mit/ohne "Entfernen"-Buttons) bleibt bewusst Sache der jeweiligen
 * Aufrufer, da sie sich zwischen Lese- und Bearbeitungs-Ansicht unterscheidet.
 */
export interface NutritionSummaryOptions {
  container: HTMLElement
  nutrientValues: NutrientValues
  requirements: NutrientRequirement[]
  profile: UserProfile
  /** Überschrift der Nährwerttabelle, z.B. "Nährwerte pro Portion" vs. "Nährwerte". */
  heading?: string
  /** Nova-Klassifikation der zugrundeliegenden Zutat(en), siehe `calculateNovaGroup` (Instruktion 17). */
  novaGroup: NovaSummary
}

export interface NutritionSummaryHandle {
  destroy(): void
}

export function renderNutritionSummary(options: NutritionSummaryOptions): NutritionSummaryHandle {
  const {
    container,
    nutrientValues,
    requirements,
    profile,
    heading = 'Nährwerte',
    novaGroup,
  } = options

  const dailyPercentages = calculateDailyRequirementPercentage(nutrientValues, requirements)

  const novaBadgeText =
    novaGroup.group === null
      ? 'Nova: keine Angabe'
      : `Nova ${novaGroup.group} – ${NOVA_LABELS[novaGroup.group]}`
  const novaBadgeHtml = `
    <p class="nova-badge" data-nova-group="${novaGroup.group ?? 'unknown'}">
      ${novaBadgeText}${
        novaGroup.incomplete && novaGroup.group !== null
          ? '<span class="nova-badge__incomplete" title="Für mindestens eine Zutat ist keine Nova-Gruppe hinterlegt – Einstufung ggf. unvollständig."> *</span>'
          : ''
      }
    </p>`

  const rows = nutrientValues
    .map((amount) => {
      const percentage = dailyPercentages.get(amount.nutrientId) ?? null
      const percentageCell =
        percentage === null
          ? '<span title="Kein Vergleich möglich – für diesen Nährstoff/diese Altersgruppe liegt kein passender Referenzwert vor.">–</span>'
          : `${Math.round(percentage)} %`

      return `
        <tr>
          <td>${NUTRIENT_LABELS[amount.nutrientId] ?? amount.nutrientId}</td>
          <td>${formatNumber(amount.value)}${amount.incomplete ? '<span class="recipe-detail__incomplete" title="Mindestens eine Zutat hat für diesen Nährstoff keinen Wert in der Datenbank – Wert ist eine Unterschätzung."> *</span>' : ''}</td>
          <td>${UNIT_LABELS[amount.unit] ?? amount.unit}</td>
          <td>${percentageCell}</td>
        </tr>`
    })
    .join('')

  const hasIncomplete = nutrientValues.some((amount) => amount.incomplete)

  container.innerHTML = `
    <h2>Bedarf vs. Aufnahme</h2>
    ${novaBadgeHtml}
    <div data-chart-container></div>

    <h2>${heading}</h2>
    <table class="requirements-table">
      <thead>
        <tr><th>Nährstoff</th><th>Wert</th><th>Einheit</th><th>% Tagesbedarf</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${hasIncomplete ? '<p class="recipe-detail__note">* Für mindestens eine Zutat fehlt in der Datenbank ein Wert für diesen Nährstoff — die Angabe ist eine Unterschätzung.</p>' : ''}
    <p class="recipe-detail__note">
      % Tagesbedarf bezogen auf dein gespeichertes Profil (${profile.age} Jahre, ${profile.gender === 'male' ? 'männlich' : 'weiblich'}).
      Bei Fett/Kohlenhydraten aus dem DACH-Energiebedarf umgerechnet; „–“ bedeutet, dass kein Vergleich möglich ist.
    </p>
  `

  const chartContainer = container.querySelector<HTMLDivElement>('[data-chart-container]')
  let chartHandle: NutrientComparisonChartHandle | null = null
  if (chartContainer) {
    chartHandle = renderNutrientComparisonChart({
      container: chartContainer,
      intake: nutrientValues,
      requirements,
    })
  }

  return {
    destroy() {
      chartHandle?.destroy()
    },
  }
}
