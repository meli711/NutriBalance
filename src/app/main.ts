import '../styles/main.css'
import type { UserProfile } from '../data/models/userProfile.ts'
import { getUserProfile } from '../data/localStorageService.ts'
import { getLocalDateString } from '../utils/date.ts'
import { renderAppShell } from './appShell.ts'
import { renderProfileForm } from '../features/profile/profileForm.ts'
import { renderProfileView } from '../features/profile/profileView.ts'
import { renderRecipeListView } from '../features/recipes/recipeListView.ts'
import { renderRecipeDetailView } from '../features/recipes/recipeDetailView.ts'
import { renderMenuListView } from '../features/menu-builder/menuListView.ts'
import { renderMenuBuilderView } from '../features/menu-builder/menuBuilderView.ts'
import { renderMenuDetailView } from '../features/menu-builder/menuDetailView.ts'
import { renderDailyLogView } from '../features/daily-log/dailyLogView.ts'
import { renderAddLogEntryView } from '../features/daily-log/addLogEntryView.ts'

const shellRoot = document.querySelector<HTMLDivElement>('#app')
const app = shellRoot ? renderAppShell(shellRoot) : null

function showForm(existingProfile: UserProfile | null): void {
  if (!app) return
  renderProfileForm({
    container: app,
    existingProfile,
    // Bearbeiten eines bestehenden Profils → zurück zur Bedarfs-Anzeige.
    // Erstmaliges Ausfüllen → direkt ins heutige Tages-Log (Instruktion 9).
    onSaved: existingProfile
      ? showView
      : (profile) => showDailyLog(profile, getLocalDateString(new Date())),
  })
}

function showView(profile: UserProfile): void {
  if (!app) return
  renderProfileView({
    container: app,
    profile,
    onEdit: () => showForm(profile),
    onShowLog: () => showDailyLog(profile, getLocalDateString(new Date())),
    onShowRecipes: () => showRecipeList(profile, () => showView(profile)),
    onShowMenus: () => showMenuList(profile, () => showView(profile)),
  })
}

function showRecipeList(profile: UserProfile, onBack: () => void): void {
  if (!app) return
  void renderRecipeListView({
    container: app,
    onSelectRecipe: (recipeId) => showRecipeDetail(profile, recipeId, onBack),
    onBack,
  })
}

function showRecipeDetail(profile: UserProfile, recipeId: string, onBackToList: () => void): void {
  if (!app) return
  void renderRecipeDetailView({
    container: app,
    recipeId,
    profile,
    onBack: () => showRecipeList(profile, onBackToList),
  })
}

function showMenuList(profile: UserProfile, onBack: () => void): void {
  if (!app) return
  void renderMenuListView({
    container: app,
    onSelectMenu: (menuId) => showMenuDetail(profile, menuId, onBack),
    onCreateNew: () => showMenuBuilder(profile, onBack),
    onBack,
  })
}

function showMenuBuilder(profile: UserProfile, onBack: () => void): void {
  if (!app) return
  renderMenuBuilderView({
    container: app,
    profile,
    onSaved: () => showMenuList(profile, onBack),
    onCancel: () => showMenuList(profile, onBack),
  })
}

function showMenuDetail(profile: UserProfile, menuId: string, onBackToList: () => void): void {
  if (!app) return
  void renderMenuDetailView({
    container: app,
    menuId,
    profile,
    onBack: () => showMenuList(profile, onBackToList),
    onDeleted: () => showMenuList(profile, onBackToList),
  })
}

function showDailyLog(profile: UserProfile, date: string): void {
  if (!app) return
  void renderDailyLogView({
    container: app,
    profile,
    date,
    onNavigateDate: (newDate) => showDailyLog(profile, newDate),
    onAddEntry: () => showAddLogEntry(profile, date),
    onShowProfile: () => showView(profile),
    onShowRecipes: () => showRecipeList(profile, () => showDailyLog(profile, date)),
    onShowMenus: () => showMenuList(profile, () => showDailyLog(profile, date)),
  })
}

function showAddLogEntry(profile: UserProfile, date: string): void {
  if (!app) return
  renderAddLogEntryView({
    container: app,
    date,
    onAdded: () => showDailyLog(profile, date),
    onCancel: () => showDailyLog(profile, date),
  })
}

const profile = getUserProfile()
if (profile) {
  showDailyLog(profile, getLocalDateString(new Date()))
} else {
  showForm(null)
}
