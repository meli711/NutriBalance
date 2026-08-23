import '../styles/main.css'
import type { UserProfile } from '../data/models/userProfile.ts'
import { getUserProfile } from '../data/localStorageService.ts'
import { getLocalDateString } from '../utils/date.ts'
import { renderAppShell } from './appShell.ts'
import { clearAppNav, renderAppNav } from './appNav.ts'
import type { NavSection } from './appNav.ts'
import { requestPersistentStorage } from './storagePersistence.ts'
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
const shell = shellRoot ? renderAppShell(shellRoot) : null
const app = shell?.content ?? null
const navSlot = shell?.nav ?? null

/** Zentrale Hauptnavigation im Header — ersetzt die zuvor pro Seite duplizierten Nav-Buttons. */
function updateNav(profile: UserProfile, active: NavSection): void {
  if (!navSlot) return
  renderAppNav({
    container: navSlot,
    active,
    onNavigate: (section) => navigateTo(profile, section),
  })
}

function navigateTo(profile: UserProfile, section: NavSection): void {
  const today = getLocalDateString(new Date())
  switch (section) {
    case 'log':
      showDailyLog(profile, today)
      break
    case 'bedarf':
      showView(profile)
      break
    case 'recipes':
      showRecipeList(profile, () => showDailyLog(profile, today))
      break
    case 'menus':
      showMenuList(profile, () => showDailyLog(profile, today))
      break
    case 'profil':
      showForm(profile)
      break
  }
}

// Backup-Import (Instruktion 10) kann Profil/Menüs/Log-Einträge ersetzt haben
// — daher hier neu aus dem Storage lesen statt ein geschlossenes `profile` weiterzuverwenden.
// Von beiden Backup-Abschnitten genutzt: `profileForm.ts` (Import ohne bestehendes Profil,
// z.B. nach Browser-Cache leeren) und `profileView.ts` (Import mit bestehendem Profil).
function handleDataImported(): void {
  const updatedProfile = getUserProfile()
  if (updatedProfile) {
    showDailyLog(updatedProfile, getLocalDateString(new Date()))
  } else {
    showForm(null)
  }
}

function showForm(existingProfile: UserProfile | null): void {
  if (!app) return
  if (existingProfile) {
    updateNav(existingProfile, 'profil')
  } else if (navSlot) {
    clearAppNav(navSlot) // vor dem ersten Profil gibt es noch nichts zu navigieren
  }
  renderProfileForm({
    container: app,
    existingProfile,
    // Bearbeiten eines bestehenden Profils → zurück zur Bedarfs-Anzeige.
    // Erstmaliges Ausfüllen → direkt ins heutige Tages-Log (Instruktion 9).
    onSaved: existingProfile
      ? showView
      : (profile) => showDailyLog(profile, getLocalDateString(new Date())),
    onDataImported: handleDataImported,
  })
}

function showView(profile: UserProfile): void {
  if (!app) return
  updateNav(profile, 'bedarf')
  renderProfileView({
    container: app,
    profile,
    onEdit: () => showForm(profile),
  })
}

function showRecipeList(profile: UserProfile, onBack: () => void): void {
  if (!app) return
  updateNav(profile, 'recipes')
  void renderRecipeListView({
    container: app,
    onSelectRecipe: (recipeId) => showRecipeDetail(profile, recipeId, onBack),
    onBack,
  })
}

function showRecipeDetail(profile: UserProfile, recipeId: string, onBackToList: () => void): void {
  if (!app) return
  updateNav(profile, 'recipes')
  void renderRecipeDetailView({
    container: app,
    recipeId,
    profile,
    onBack: () => showRecipeList(profile, onBackToList),
  })
}

function showMenuList(profile: UserProfile, onBack: () => void): void {
  if (!app) return
  updateNav(profile, 'menus')
  void renderMenuListView({
    container: app,
    onSelectMenu: (menuId) => showMenuDetail(profile, menuId, onBack),
    onCreateNew: () => showMenuBuilder(profile, onBack),
    onBack,
  })
}

function showMenuBuilder(profile: UserProfile, onBack: () => void): void {
  if (!app) return
  updateNav(profile, 'menus')
  renderMenuBuilderView({
    container: app,
    profile,
    onSaved: () => showMenuList(profile, onBack),
    onCancel: () => showMenuList(profile, onBack),
  })
}

function showMenuDetail(profile: UserProfile, menuId: string, onBackToList: () => void): void {
  if (!app) return
  updateNav(profile, 'menus')
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
  updateNav(profile, 'log')
  void renderDailyLogView({
    container: app,
    profile,
    date,
    onNavigateDate: (newDate) => showDailyLog(profile, newDate),
    onAddEntry: () => showAddLogEntry(profile, date),
  })
}

function showAddLogEntry(profile: UserProfile, date: string): void {
  if (!app) return
  updateNav(profile, 'log')
  renderAddLogEntryView({
    container: app,
    date,
    onAdded: () => showDailyLog(profile, date),
    onCancel: () => showDailyLog(profile, date),
  })
}

void requestPersistentStorage() // best-effort, blockiert den Start nicht (siehe storagePersistence.ts)

const profile = getUserProfile()
if (profile) {
  showDailyLog(profile, getLocalDateString(new Date()))
} else {
  showForm(null)
}
