import '../styles/main.css'
import type { UserProfile } from '../data/models/userProfile.ts'
import { getUserProfile } from '../data/localStorageService.ts'
import { renderAppShell } from './appShell.ts'
import { renderProfileForm } from '../features/profile/profileForm.ts'
import { renderProfileView } from '../features/profile/profileView.ts'
import { renderRecipeListView } from '../features/recipes/recipeListView.ts'
import { renderRecipeDetailView } from '../features/recipes/recipeDetailView.ts'
import { renderMenuListView } from '../features/menu-builder/menuListView.ts'
import { renderMenuBuilderView } from '../features/menu-builder/menuBuilderView.ts'
import { renderMenuDetailView } from '../features/menu-builder/menuDetailView.ts'

const shellRoot = document.querySelector<HTMLDivElement>('#app')
const app = shellRoot ? renderAppShell(shellRoot) : null

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
    onShowMenus: () => showMenuList(profile),
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
    profile,
    onBack: () => showRecipeList(profile),
  })
}

function showMenuList(profile: UserProfile): void {
  if (!app) return
  void renderMenuListView({
    container: app,
    onSelectMenu: (menuId) => showMenuDetail(profile, menuId),
    onCreateNew: () => showMenuBuilder(profile),
    onBack: () => showView(profile),
  })
}

function showMenuBuilder(profile: UserProfile): void {
  if (!app) return
  renderMenuBuilderView({
    container: app,
    profile,
    onSaved: () => showMenuList(profile),
    onCancel: () => showMenuList(profile),
  })
}

function showMenuDetail(profile: UserProfile, menuId: string): void {
  if (!app) return
  void renderMenuDetailView({
    container: app,
    menuId,
    profile,
    onBack: () => showMenuList(profile),
    onDeleted: () => showMenuList(profile),
  })
}

const profile = getUserProfile()
if (profile) {
  showView(profile)
} else {
  showForm(null)
}
