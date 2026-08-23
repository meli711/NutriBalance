import { getFoodById } from '../../data/foodDatabaseService.ts'
import type { FoodItem } from '../../data/models/food.ts'
import type { UserProfile } from '../../data/models/userProfile.ts'
import { deleteMenu, getMenuById } from '../../data/indexedDbService.ts'
import { getRequirementOverrides } from '../../data/localStorageService.ts'
import { getRequirementsForProfile } from '../nutrient-requirements/requirementService.ts'
import type { NutrientRequirement } from '../nutrient-requirements/models/requirement.ts'
import { calculateNutrition } from '../recipes/nutritionCalculator.ts'
import { getAllRecipes } from '../recipes/recipeService.ts'
import { renderNutritionSummary } from '../nutrition-summary/nutritionSummaryView.ts'
import type { NutritionSummaryHandle } from '../nutrition-summary/nutritionSummaryView.ts'
import { formatNumber } from '../../utils/formatNumber.ts'
import { isValidRecipeArray, menuToRecipe } from './menuExportService.ts'
import type { Menu } from './models/menu.ts'

export interface MenuDetailViewOptions {
  container: HTMLElement
  menuId: string
  profile: UserProfile
  onBack: () => void
  onDeleted: () => void
}

let activeSummary: NutritionSummaryHandle | null = null

function destroyActiveSummary(): void {
  activeSummary?.destroy()
  activeSummary = null
}

function getRequirementsSafely(profile: UserProfile): NutrientRequirement[] {
  try {
    return getRequirementsForProfile(profile, getRequirementOverrides())
  } catch {
    return []
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function downloadJson(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** `null` = Nutzer:in hat abgebrochen oder ungültige Eingabe gemacht (Fehlermeldung ist bereits gesetzt). */
function promptForServings(statusEl: HTMLElement): number | null {
  const raw = window.prompt('Wie viele Portionen ergibt dieses Menü?', '1')
  if (raw === null) return null // Abbruch, keine Fehlermeldung nötig

  const servings = Number(raw.trim().replace(',', '.'))
  if (!Number.isFinite(servings) || servings <= 0) {
    statusEl.textContent = 'Bitte eine Zahl grösser als 0 eingeben.'
    statusEl.className = 'field-error'
    statusEl.hidden = false
    return null
  }
  return servings
}

async function handleExportAsRecipe(menu: Menu, statusEl: HTMLElement): Promise<void> {
  statusEl.hidden = true

  // Siehe Instruktion 6: ein Menü ohne Zutaten lässt sich gar nicht erst
  // speichern — trotzdem defensiv geprüft, statt es beim Export vorauszusetzen.
  if (menu.ingredients.length === 0) {
    statusEl.textContent = 'Dieses Menü hat keine Zutaten und kann nicht exportiert werden.'
    statusEl.className = 'field-error'
    statusEl.hidden = false
    return
  }

  const servings = promptForServings(statusEl)
  if (servings === null) return

  let currentRecipes
  try {
    currentRecipes = await getAllRecipes()
  } catch {
    statusEl.textContent =
      'Die aktuelle Rezeptliste konnte nicht geladen werden. Export abgebrochen (keine Datei wurde erzeugt).'
    statusEl.className = 'field-error'
    statusEl.hidden = false
    return
  }

  if (!isValidRecipeArray(currentRecipes)) {
    statusEl.textContent =
      'Die aktuelle recipes.json hat ein unerwartetes Format. Export abgebrochen, um keine kaputte Datei zu erzeugen.'
    statusEl.className = 'field-error'
    statusEl.hidden = false
    return
  }

  const existingIds = currentRecipes.map((recipe) => recipe.id)
  const newRecipe = menuToRecipe(menu, servings, existingIds)
  const updatedRecipes = [...currentRecipes, newRecipe]

  downloadJson('recipes-updated.json', updatedRecipes)

  statusEl.textContent =
    'Datei heruntergeladen. Um sie zu übernehmen: recipes-updated.json nach public/data/recipes.json ' +
    'verschieben/umbenennen und im Projekt committen — das Menü bleibt zusätzlich unverändert in ' +
    '"Eigene Menüs" gespeichert.'
  statusEl.className = 'recipe-detail__note'
  statusEl.hidden = false
}

export async function renderMenuDetailView(options: MenuDetailViewOptions): Promise<void> {
  const { container, menuId, profile, onBack, onDeleted } = options
  destroyActiveSummary()

  const handleBack = (): void => {
    destroyActiveSummary()
    onBack()
  }

  container.innerHTML = `
    <section class="recipe-detail">
      <p class="recipe-list__status">Lade Menü…</p>
    </section>
  `

  const menu = await getMenuById(menuId)
  if (!menu) {
    container.innerHTML = `
      <section class="recipe-detail">
        <p class="field-error" role="alert">Menü nicht gefunden.</p>
        <button type="button" class="button-secondary" data-action="back">Zurück</button>
      </section>
    `
    container.querySelector('[data-action="back"]')?.addEventListener('click', handleBack)
    return
  }

  const foods = await Promise.all(menu.ingredients.map((ing) => getFoodById(ing.foodId)))
  const foodsById = new Map<string, FoodItem>()
  foods.forEach((food, index) => {
    if (food) foodsById.set(menu.ingredients[index]!.foodId, food)
  })

  const nutrientValues = calculateNutrition(menu.ingredients, foodsById)
  const requirements = getRequirementsSafely(profile)

  const ingredientRows = menu.ingredients
    .map((ingredient) => {
      const food = foodsById.get(ingredient.foodId)
      const name = food?.name.de ?? `Unbekannte Zutat (${ingredient.foodId})`
      return `<tr><td>${name}</td><td>${formatNumber(ingredient.amountGrams)} g</td></tr>`
    })
    .join('')

  container.innerHTML = `
    <section class="recipe-detail">
      <h1>${menu.name}</h1>
      <p class="recipe-detail__meta">Erstellt am ${formatDate(menu.createdAt)}</p>
      ${menu.description ? `<p class="recipe-detail__meta">${menu.description}</p>` : ''}

      <h2>Zutaten</h2>
      <table class="recipe-detail__table">
        <tbody>${ingredientRows}</tbody>
      </table>

      <div data-summary-container></div>

      <p class="recipe-detail__note" data-export-status hidden></p>

      <div class="profile-view__actions">
        <button type="button" class="button-secondary" data-action="export">Als Rezept exportieren</button>
        <button type="button" class="button-secondary" data-action="back">Zurück zur Menü-Liste</button>
        <button type="button" class="menu-list__delete-full" data-action="delete">Menü löschen</button>
      </div>
    </section>
  `

  const summaryContainer = container.querySelector<HTMLDivElement>('[data-summary-container]')
  if (summaryContainer) {
    activeSummary = renderNutritionSummary({
      container: summaryContainer,
      nutrientValues,
      requirements,
      profile,
      heading: 'Nährwerte',
    })
  }

  container.querySelector('[data-action="back"]')?.addEventListener('click', handleBack)
  container.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
    if (!window.confirm('Dieses Menü wirklich löschen?')) return
    await deleteMenu(menuId)
    destroyActiveSummary()
    onDeleted()
  })

  const exportStatus = container.querySelector<HTMLParagraphElement>('[data-export-status]')
  container.querySelector('[data-action="export"]')?.addEventListener('click', () => {
    if (!exportStatus) return
    void handleExportAsRecipe(menu, exportStatus)
  })
}
