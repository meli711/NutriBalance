import type { UserProfile } from '../../data/models/userProfile.ts'
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

export function renderProfileView(options: ProfileViewOptions): void {
  const { container, profile, onEdit } = options
  const genderLabel = profile.gender === 'male' ? 'Männlich' : 'Weiblich'

  let bodyHtml: string
  try {
    const ageGroup = findAgeGroup(profile.age)
    const requirements = getRequirementsForProfile(profile)
    const rows = requirements
      .map(
        (req) => `
          <tr>
            <td>${NUTRIENT_LABELS[req.nutrientId] ?? req.nutrientId}</td>
            <td>${formatRequirementValue(req)}</td>
            <td>${UNIT_LABELS[req.unit] ?? req.unit}</td>
          </tr>`,
      )
      .join('')

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
}
