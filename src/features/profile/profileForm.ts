import type { Gender, UserProfile } from '../../data/models/userProfile.ts'
import { saveUserProfile } from '../../data/localStorageService.ts'

export interface ProfileFormOptions {
  container: HTMLElement
  existingProfile: UserProfile | null
  onSaved: (profile: UserProfile) => void
}

export const AGE_MIN = 10
export const AGE_MAX = 100
export const HEIGHT_MIN_CM = 100
export const HEIGHT_MAX_CM = 230

/**
 * Reine Validierungslogik, getrennt vom DOM-Handling, damit sie ohne
 * Browser-Umgebung getestet werden kann.
 */
export function validateProfileInput(
  age: number,
  gender: unknown,
  heightCm: number,
): string | null {
  if (!Number.isFinite(age) || age < AGE_MIN || age > AGE_MAX) {
    return `Bitte ein gültiges Alter zwischen ${AGE_MIN} und ${AGE_MAX} Jahren eingeben.`
  }
  if (gender !== 'male' && gender !== 'female') {
    return 'Bitte ein Geschlecht auswählen.'
  }
  if (!Number.isFinite(heightCm) || heightCm < HEIGHT_MIN_CM || heightCm > HEIGHT_MAX_CM) {
    return `Bitte eine gültige Grösse zwischen ${HEIGHT_MIN_CM} und ${HEIGHT_MAX_CM} cm eingeben.`
  }
  return null
}

export function renderProfileForm(options: ProfileFormOptions): void {
  const { container, existingProfile, onSaved } = options

  container.innerHTML = `
    <form class="profile-form" novalidate>
      <h1>${existingProfile ? 'Profil bearbeiten' : 'Willkommen bei NutriBalance'}</h1>
      <p class="profile-form__intro">
        Für die Berechnung deines Nährstoffbedarfs brauchen wir Alter, Geschlecht und Grösse.
      </p>

      <div class="field">
        <label for="profile-age">Alter (Jahre)</label>
        <input
          id="profile-age"
          name="age"
          type="number"
          inputmode="numeric"
          min="${AGE_MIN}"
          max="${AGE_MAX}"
          required
          value="${existingProfile?.age ?? ''}"
        />
      </div>

      <fieldset class="field">
        <legend>Geschlecht</legend>
        <label class="radio-option">
          <input
            type="radio"
            name="gender"
            value="female"
            ${existingProfile?.gender === 'female' ? 'checked' : ''}
            required
          />
          Weiblich
        </label>
        <label class="radio-option">
          <input
            type="radio"
            name="gender"
            value="male"
            ${existingProfile?.gender === 'male' ? 'checked' : ''}
            required
          />
          Männlich
        </label>
      </fieldset>

      <div class="field">
        <label for="profile-height">Grösse (cm)</label>
        <input
          id="profile-height"
          name="heightCm"
          type="number"
          inputmode="numeric"
          min="${HEIGHT_MIN_CM}"
          max="${HEIGHT_MAX_CM}"
          required
          value="${existingProfile?.heightCm ?? ''}"
        />
      </div>

      <p class="field-error" role="alert" hidden></p>

      <button type="submit" class="button-primary">Speichern</button>
    </form>
  `

  const form = container.querySelector<HTMLFormElement>('.profile-form')
  const errorEl = container.querySelector<HTMLParagraphElement>('.field-error')
  if (!form || !errorEl) return

  form.addEventListener('submit', (event) => {
    event.preventDefault()

    const formData = new FormData(form)
    const age = Number(formData.get('age'))
    const heightCm = Number(formData.get('heightCm'))
    const gender = formData.get('gender')

    const validationError = validateProfileInput(age, gender, heightCm)
    if (validationError) {
      errorEl.textContent = validationError
      errorEl.hidden = false
      return
    }

    errorEl.hidden = true
    errorEl.textContent = ''

    const profile: UserProfile = { age, gender: gender as Gender, heightCm }
    saveUserProfile(profile)
    onSaved(profile)
  })
}
