import {
  CUSTOM_FOOD_ID_PREFIX,
  createCustomFood,
  getCustomFoods,
  saveCustomFoods,
  upsertCustomFood,
} from '../../data/customFoodService.ts'
import type { FoodItem } from '../../data/models/food.ts'
import { formatNumber } from '../../utils/formatNumber.ts'
import { renderCustomFoodForm } from './customFoodForm.ts'
import { parseBackupJson } from '../backup/backupService.ts'
import type { BackupData } from '../backup/models/backup.ts'
import { mergeImportedItems } from '../backup/partialImportService.ts'
import { renderImportSelection } from '../backup/importSelectionView.ts'

export interface OwnFoodsPanelOptions {
  container: HTMLElement
  onSelectFood: (foodId: string) => void
}

function summarizeFood(food: FoodItem): string {
  const parts: string[] = []
  if (food.energyKcal !== null) parts.push(`${formatNumber(food.energyKcal)} kcal`)
  if (food.protein !== null) parts.push(`${formatNumber(food.protein)} g Protein`)
  if (food.fat !== null) parts.push(`${formatNumber(food.fat)} g Fett`)
  if (food.carbohydrates !== null) parts.push(`${formatNumber(food.carbohydrates)} g KH`)
  return parts.length > 0 ? `${parts.join(' · ')} (pro 100 g)` : 'Keine Nährwerte erfasst'
}

function generateCustomFoodId(): string {
  return `${CUSTOM_FOOD_ID_PREFIX}${crypto.randomUUID()}`
}

/**
 * Statusmeldung nach einem selektiven Import (Instruktion 18) — analog zur
 * Formulierung in `menuListView.ts`.
 */
function buildImportStatusMessage(importedCount: number, skippedIdenticalCount: number): string {
  if (importedCount === 0) return 'Keine Zutaten importiert (bereits identisch vorhanden).'
  const parts = [`${importedCount} Zutat${importedCount === 1 ? '' : 'en'} importiert`]
  if (skippedIdenticalCount > 0) {
    parts.push(`${skippedIdenticalCount} bereits identisch vorhanden (übersprungen)`)
  }
  return `${parts.join(', ')}.`
}

/**
 * Tab "Eigene Zutaten" (Instruktion 14, umgezogen von der Profilseite,
 * Instruktion 13). Anders als die bisherige `customFoodsSectionView.ts`:
 * ein Klick auf eine Zutat öffnet nicht mehr direkt das Bearbeiten-Formular,
 * sondern dieselbe Detailansicht mit Nährwerttabelle + Chart wie generische
 * Zutaten (`foodDetailView.ts`), die dort Bearbeiten/Löschen anbietet — nur
 * das Erfassen einer **neuen** Zutat passiert weiterhin direkt hier (es gibt
 * ja noch nichts anzuzeigen).
 *
 * Seit Instruktion 18 zusätzlich: "Zutaten importieren" liest gezielt
 * einzelne, per Name angewählte eigene Zutaten aus einer vollen Backup-
 * Datei (Instruktion 10) und fügt sie additiv hinzu — im Unterschied zum
 * vollen "Daten wiederherstellen" auf der Profilseite bleibt dabei alles
 * andere (Profil, Bedarfs-Anpassungen, Log-Einträge, restliche eigene
 * Zutaten) unangetastet, siehe `partialImportService.ts`.
 */
type PanelMode =
  { type: 'list'; status?: string } | { type: 'create' } | { type: 'import'; data: BackupData }

export function renderOwnFoodsPanel(options: OwnFoodsPanelOptions): void {
  const { container, onSelectFood } = options

  let mode: PanelMode = { type: 'list' }

  function setMode(next: typeof mode): void {
    mode = next
    render()
  }

  function renderList(): void {
    const status = mode.type === 'list' ? mode.status : undefined
    container.innerHTML = `
      <p class="profile-view__meta">
        Zutaten, die in der Nährwertdatenbank fehlen, lassen sich hier selbst erfassen
        (nur Energie und Makronährstoffe). Sie stehen danach überall zur Auswahl, wo
        nach Zutaten gesucht wird, und werden im Daten-Backup auf der Profilseite
        mitgesichert.
      </p>
      ${status ? `<p class="recipe-detail__note">${status}</p>` : ''}
      <p class="field-error" data-import-error hidden></p>
      <div class="field recipe-list__search">
        <input id="own-food-search" type="text" autocomplete="off" placeholder="Name eingeben" aria-label="Eigene Zutaten durchsuchen" />
      </div>
      <ul class="recipe-list__items" data-list></ul>
      <div class="profile-view__actions">
        <button type="button" class="button-secondary" data-action="add">+ Neue Zutat erfassen</button>
        <button type="button" class="button-secondary" data-action="import">Zutaten importieren</button>
      </div>
      <input type="file" accept=".json,application/json" data-file-input hidden />
    `

    const searchInput = container.querySelector<HTMLInputElement>('#own-food-search')!
    const listEl = container.querySelector<HTMLUListElement>('[data-list]')!
    const importErrorEl = container.querySelector<HTMLParagraphElement>('[data-import-error]')!
    const fileInput = container.querySelector<HTMLInputElement>('[data-file-input]')!

    function renderRows(foods: FoodItem[]): void {
      if (foods.length === 0) {
        listEl.innerHTML = '<li class="recipe-list__status">Keine eigenen Zutaten gefunden.</li>'
        return
      }
      listEl.innerHTML = foods
        .map(
          (food) => `
            <li>
              <button type="button" class="recipe-list__item" data-food-id="${food.id}">
                <span class="recipe-list__label">
                  <span class="recipe-list__name">${food.name.de}</span>
                </span>
                <span class="recipe-list__servings">${summarizeFood(food)}</span>
              </button>
            </li>`,
        )
        .join('')

      listEl.querySelectorAll<HTMLButtonElement>('[data-food-id]').forEach((button) => {
        button.addEventListener('click', () => {
          const foodId = button.dataset.foodId
          if (foodId) onSelectFood(foodId)
        })
      })
    }

    function applyFilter(): void {
      const allFoods = getCustomFoods()
      if (allFoods.length === 0) {
        listEl.innerHTML =
          '<li class="recipe-list__status">Noch keine eigenen Zutaten erfasst.</li>'
        return
      }

      const query = searchInput.value.trim().toLowerCase()
      const sorted = [...allFoods].sort((a, b) => a.name.de.localeCompare(b.name.de, 'de'))
      const foods =
        query === '' ? sorted : sorted.filter((food) => food.name.de.toLowerCase().includes(query))
      renderRows(foods)
    }

    searchInput.addEventListener('input', applyFilter)
    applyFilter()

    container.querySelector('[data-action="add"]')?.addEventListener('click', () => {
      setMode({ type: 'create' })
    })

    container.querySelector('[data-action="import"]')?.addEventListener('click', () => {
      fileInput.click()
    })

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0]
      fileInput.value = '' // erlaubt erneute Auswahl derselben Datei
      if (!file) return

      void (async () => {
        const raw = await file.text()
        const result = parseBackupJson(raw)
        if (!result.ok) {
          importErrorEl.textContent = result.error
          importErrorEl.hidden = false
          return
        }
        setMode({ type: 'import', data: result.data })
      })()
    })
  }

  function renderCreate(): void {
    container.innerHTML = ''
    renderCustomFoodForm({
      container,
      existingFood: null,
      onSave: (input) => {
        upsertCustomFood(createCustomFood(input))
        setMode({ type: 'list' })
      },
      onCancel: () => setMode({ type: 'list' }),
    })
  }

  function renderImport(data: BackupData): void {
    const sortedFoods = [...data.customFoods].sort((a, b) =>
      a.name.de.localeCompare(b.name.de, 'de'),
    )
    renderImportSelection({
      container,
      title: 'Zutaten aus Backup-Datei importieren',
      emptyMessage: 'Die Backup-Datei enthält keine eigenen Zutaten.',
      items: sortedFoods.map((food) => ({
        id: food.id,
        label: food.name.de,
        description: summarizeFood(food),
      })),
      confirmLabel: 'Ausgewählte Zutaten importieren',
      onConfirm: (selectedIds) => {
        const selected = data.customFoods.filter((food) => selectedIds.includes(food.id))
        const merge = mergeImportedItems(getCustomFoods(), selected, generateCustomFoodId)
        saveCustomFoods(merge.items)
        setMode({
          type: 'list',
          status: buildImportStatusMessage(merge.importedCount, merge.skippedIdenticalCount),
        })
      },
      onCancel: () => setMode({ type: 'list' }),
    })
  }

  function render(): void {
    if (mode.type === 'list') renderList()
    else if (mode.type === 'create') renderCreate()
    else renderImport(mode.data)
  }

  render()
}
