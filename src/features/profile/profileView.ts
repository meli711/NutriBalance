import type { UserProfile } from '../../data/models/userProfile.ts'
import {
  getRequirementOverrides,
  saveRequirementOverrides,
} from '../../data/localStorageService.ts'
import type { RequirementOverrides } from '../../data/localStorageService.ts'
import {
  findAgeGroup,
  getRequirementsForProfile,
} from '../nutrient-requirements/requirementService.ts'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import { NUTRIENT_LABELS, UNIT_LABELS } from '../../utils/nutrientLabels.ts'
import { formatNumber } from '../../utils/formatNumber.ts'

export interface ProfileViewOptions {
  container: HTMLElement
  profile: UserProfile
  onEdit: () => void
}

function formatRequirementRange(requirement: NutrientRequirement): string {
  const { min, max } = requirement
  if (min !== undefined && max !== undefined)
    return `Bereich: ${formatNumber(min)}–${formatNumber(max)}`
  if (min !== undefined) return `Mindestens ${formatNumber(min)}`
  if (max !== undefined) return `Höchstens ${formatNumber(max)}`
  return ''
}

function formatRequirementValue(requirement: NutrientRequirement): string {
  const { min, recommended, max } = requirement
  if (recommended !== undefined && min !== undefined && max !== undefined) {
    return `${formatNumber(recommended)} (${formatNumber(min)}–${formatNumber(max)})`
  }
  if (recommended !== undefined) return formatNumber(recommended)
  if (min !== undefined && max !== undefined) return `${formatNumber(min)}–${formatNumber(max)}`
  if (min !== undefined) return `≥ ${formatNumber(min)}`
  if (max !== undefined) return `≤ ${formatNumber(max)}`
  return '–'
}

/**
 * Nur Nährstoffe mit einem festen `recommended`-Wert sind editierbar (z.B.
 * Energie, Protein) — reine Richtwert-Bereiche ohne Zielwert (z.B.
 * "≥ 30g Ballaststoffe") lassen sich nicht sinnvoll manuell anpassen.
 */
function renderRequirementRow(req: NutrientRequirement): string {
  const label = NUTRIENT_LABELS[req.nutrientId] ?? req.nutrientId
  const unitLabel = UNIT_LABELS[req.unit] ?? req.unit

  if (req.recommended === undefined) {
    return `
      <tr>
        <td>${label}</td>
        <td>${formatRequirementValue(req)}</td>
        <td>${unitLabel}</td>
      </tr>`
  }

  const rangeHint = formatRequirementRange(req)
  return `
    <tr class="${req.isOverridden ? 'requirements-table__row--overridden' : ''}">
      <td>
        <label for="req-${req.nutrientId}">${label}</label>
        ${req.isOverridden ? '<span class="requirements-table__badge">angepasst</span>' : ''}
      </td>
      <td>
        <input
          type="number"
          inputmode="decimal"
          step="any"
          min="0"
          class="requirements-table__input"
          id="req-${req.nutrientId}"
          data-nutrient-id="${req.nutrientId}"
          value="${req.recommended}"
        />
        ${rangeHint ? `<p class="requirements-table__hint">${rangeHint}</p>` : ''}
        ${
          req.isOverridden
            ? `<button type="button" class="requirements-table__reset" data-reset-nutrient-id="${req.nutrientId}">Zurücksetzen auf berechneten Wert</button>`
            : ''
        }
      </td>
      <td>${unitLabel}</td>
    </tr>`
}

export function renderProfileView(options: ProfileViewOptions): void {
  const { container, profile, onEdit } = options
  const genderLabel = profile.gender === 'male' ? 'Männlich' : 'Weiblich'
  const overrides = getRequirementOverrides()

  function updateOverride(nutrientId: string, value: number | null): void {
    const next: RequirementOverrides = { ...overrides }
    if (value === null) delete next[nutrientId]
    else next[nutrientId] = value
    saveRequirementOverrides(next)
    renderProfileView(options)
  }

  let bodyHtml: string
  try {
    const ageGroup = findAgeGroup(profile.age)
    const requirements = getRequirementsForProfile(profile, overrides)
    const hasEditableRows = requirements.some((req) => req.recommended !== undefined)
    const rows = requirements.map(renderRequirementRow).join('')

    bodyHtml = `
      <p class="profile-view__meta">
        ${genderLabel}, ${profile.age} Jahre (Altersgruppe: ${ageGroup.label}), ${profile.heightCm} cm
      </p>
      <table class="requirements-table">
        <thead>
          <tr><th>Nährstoff</th><th>Wert</th><th>Einheit</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${
        hasEditableRows
          ? `<p class="profile-view__meta">
               Werte lassen sich anpassen — z.B. wer weniger Kalorien verbraucht oder mehr Protein
               möchte, trägt hier den eigenen Zielwert statt des berechneten Werts ein.
             </p>`
          : ''
      }
    `
  } catch {
    bodyHtml = `
      <p class="profile-view__meta">${genderLabel}, ${profile.age} Jahre, ${profile.heightCm} cm</p>
      <p class="field-error" role="alert">
        Für dieses Alter liegen noch keine DACH-Referenzwerte vor (aktuell abgedeckt: ab 15 Jahren).
      </p>
    `
  }

  container.innerHTML = `
    <section class="profile-view">
      <h1>Dein Nährstoffbedarf</h1>
      <figure class="profile-view__hero">
        <img
          src="${import.meta.env.BASE_URL}images/header-balanced-meals.jpg"
          alt="Ausgewogene Teller mit Lachs, Gemüse, Vollkorn und frischen Zutaten"
          width="1000"
          height="520"
          loading="eager"
        />
        <figcaption>Foto: Shayda Torabi / Unsplash</figcaption>
      </figure>
      ${bodyHtml}
      <div class="profile-view__actions">
        <button type="button" class="button-primary" data-action="edit">Profil bearbeiten</button>
      </div>
    </section>
  `

  container.querySelector('[data-action="edit"]')?.addEventListener('click', onEdit)

  container.querySelectorAll<HTMLInputElement>('[data-nutrient-id]').forEach((input) => {
    input.addEventListener('change', () => {
      const nutrientId = input.dataset.nutrientId
      if (!nutrientId) return
      const value = input.valueAsNumber
      updateOverride(nutrientId, Number.isFinite(value) && value > 0 ? value : null)
    })
  })

  container.querySelectorAll<HTMLButtonElement>('[data-reset-nutrient-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const nutrientId = button.dataset.resetNutrientId
      if (!nutrientId) return
      updateOverride(nutrientId, null)
    })
  })
}
