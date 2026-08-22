import '../styles/main.css'
import type { UserProfile } from '../data/models/userProfile.ts'
import { getUserProfile } from '../data/localStorageService.ts'
import { renderProfileForm } from '../features/profile/profileForm.ts'
import { renderProfileView } from '../features/profile/profileView.ts'
import { renderRecipeListView } from '../features/recipes/recipeListView.ts'
import { renderRecipeDetailView } from '../features/recipes/recipeDetailView.ts'

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
    onShowRecipes: () => showRecipeList(profile),
  })
}

function showRecipeList(profile: UserProfile): void {
  if (!app) return
  void renderRecipeListView({
    container: app,
    onSelectRecipe: (recipeId) => showRecipeDetail(profile, recipeId),
    onBack: () => showView(profile),
  })
}

function showRecipeDetail(profile: UserProfile, recipeId: string): void {
  if (!app) return
  void renderRecipeDetailView({
    container: app,
    recipeId,
    onBack: () => showRecipeList(profile),
  })
}

const profile = getUserProfile()
if (profile) {
  showView(profile)
} else {
  showForm(null)
}
