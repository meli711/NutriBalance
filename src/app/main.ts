import '../styles/main.css'
import type { UserProfile } from '../data/models/userProfile.ts'
import { getUserProfile } from '../data/localStorageService.ts'
import { renderProfileForm } from '../features/profile/profileForm.ts'
import { renderProfileView } from '../features/profile/profileView.ts'

const app = document.querySelector<HTMLDivElement>('#app')

function showForm(existingProfile: UserProfile | null): void {
  if (!app) return
  renderProfileForm({
    container: app,
    existingProfile,
    onSaved: showView,
  })
}

function showView(profile: UserProfile): void {
  if (!app) return
  renderProfileView({
    container: app,
    profile,
    onEdit: () => showForm(profile),
  })
}

const profile = getUserProfile()
if (profile) {
  showView(profile)
} else {
  showForm(null)
}
