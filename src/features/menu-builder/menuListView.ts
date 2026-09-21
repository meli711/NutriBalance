import { getAllMenus, deleteMenu, saveMenu } from '../../data/indexedDbService.ts'
import {
  getCustomFoods,
  saveCustomFoods,
  CUSTOM_FOOD_ID_PREFIX,
} from '../../data/customFoodService.ts'
import { buildMenuDeleteConfirmMessage, countMenuUsage } from '../shared/referenceUsageService.ts'
import { parseBackupJson } from '../backup/backupService.ts'
import type { BackupData } from '../backup/models/backup.ts'
import {
  findMissingCustomFoodIds,
  mergeImportedItems,
  remapMenuIngredients,
  resolveReferencedCustomFoods,
} from '../backup/partialImportService.ts'
import { renderImportSelection } from '../backup/importSelectionView.ts'
import type { FoodItem } from '../../data/models/food.ts'
import type { Menu } from './models/menu.ts'

export interface MenuListViewOptions {
  container: HTMLElement
  onSelectMenu: (menuId: string) => void
  onCreateNew: () => void
  onBack: () => void
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function generateCustomFoodId(): string {
  return `${CUSTOM_FOOD_ID_PREFIX}${crypto.randomUUID()}`
}

/** Namen der lokal fehlenden, aber in der Backup-Datei auflösbaren Zutaten dieses Menüs — für den Auswahl-Hinweistext (Instruktion 18). */
function describeMissingIngredients(
  menu: Menu,
  data: BackupData,
  localCustomFoods: FoodItem[],
): string {
  const missingIds = findMissingCustomFoodIds(menu, localCustomFoods)
  if (missingIds.length === 0) return ''

  const backupById = new Map(data.customFoods.map((food) => [food.id, food]))
  const resolvedNames = missingIds
    .map((id) => backupById.get(id)?.name.de)
    .filter((name): name is string => !!name)
  const unresolvedCount = missingIds.length - resolvedNames.length

  const parts: string[] = []
  if (resolvedNames.length > 0) parts.push(`bringt automatisch mit: ${resolvedNames.join(', ')}`)
  if (unresolvedCount > 0) {
    parts.push(
      `enthält ${unresolvedCount} nicht auflösbare Zutat${unresolvedCount === 1 ? '' : 'en'} (erscheint als "Unbekannte Zutat")`,
    )
  }
  return parts.join(' · ')
}

function buildImportStatusMessage(
  menuMerge: { importedCount: number; skippedIdenticalCount: number },
  foodMerge: { importedCount: number },
): string {
  if (menuMerge.importedCount === 0) return 'Keine Menüs importiert (bereits identisch vorhanden).'
  const parts = [
    `${menuMerge.importedCount} Menü${menuMerge.importedCount === 1 ? '' : 's'} importiert`,
  ]
  if (foodMerge.importedCount > 0) {
    parts.push(
      `${foodMerge.importedCount} eigene Zutat${foodMerge.importedCount === 1 ? '' : 'en'} automatisch mitgebracht`,
    )
  }
  if (menuMerge.skippedIdenticalCount > 0) {
    parts.push(`${menuMerge.skippedIdenticalCount} bereits identisch vorhanden (übersprungen)`)
  }
  return `${parts.join(', ')}.`
}

export async function renderMenuListView(options: MenuListViewOptions): Promise<void> {
  const { container, onSelectMenu, onCreateNew, onBack } = options

  let mode: { type: 'list'; status?: string } | { type: 'import' } = { type: 'list' }

  function renderItems(list: Menu[]): string {
    return list
      .map(
        (menu) => `
          <li class="menu-list__row">
            <button type="button" class="recipe-list__item" data-menu-id="${menu.id}">
              <span class="recipe-list__name">${menu.name}</span>
              <span class="recipe-list__servings">${formatDate(menu.createdAt)}</span>
            </button>
            <button type="button" class="menu-list__delete" data-delete-id="${menu.id}" aria-label="Menü löschen">✕</button>
          </li>`,
      )
      .join('')
  }

  async function renderList(): Promise<void> {
    let menus: Menu[]
    try {
      menus = await getAllMenus()
    } catch {
      container.innerHTML = `
        <section class="recipe-list">
          <h1 class="type-heading-menu">Eigene Menüs</h1>
          <p class="field-error" role="alert">Menüs konnten nicht geladen werden.</p>
          <button type="button" class="button-secondary" data-action="back">Zurück</button>
        </section>
      `
      container.querySelector('[data-action="back"]')?.addEventListener('click', onBack)
      return
    }

    menus = menus.slice().sort((a, b) => a.name.localeCompare(b.name, 'de'))
    const showSearch = menus.length > 10
    const status = mode.type === 'list' ? mode.status : undefined

    container.innerHTML = `
      <section class="recipe-list">
        <h1 class="type-heading-menu">Eigene Menüs</h1>
        ${status ? `<p class="recipe-detail__note">${status}</p>` : ''}
        <p class="field-error" data-import-error hidden></p>
        ${
          showSearch
            ? `<div class="field recipe-list__search">
                 <input id="menu-search" type="text" autocomplete="off" placeholder="Name eingeben" aria-label="Menüs durchsuchen" />
               </div>`
            : ''
        }
        ${
          menus.length === 0
            ? '<p class="recipe-list__status">Noch keine Menüs gespeichert.</p>'
            : `<ul class="recipe-list__items" data-list>${renderItems(menus)}</ul>`
        }
        <div class="recipe-list__actions">
          <button type="button" class="button-primary" data-action="create">Neues Menü erstellen</button>
          <button type="button" class="button-secondary" data-action="import">Menüs importieren</button>
          <button type="button" class="button-secondary" data-action="back">Zurück</button>
        </div>
        <input type="file" accept=".json,application/json" data-file-input hidden />
      </section>
    `

    function bindRowEvents(): void {
      const listEl = container.querySelector<HTMLUListElement>('[data-list]')
      if (!listEl) return

      listEl.querySelectorAll<HTMLButtonElement>('[data-menu-id]').forEach((button) => {
        button.addEventListener('click', () => {
          const menuId = button.dataset.menuId
          if (menuId) onSelectMenu(menuId)
        })
      })

      listEl.querySelectorAll<HTMLButtonElement>('[data-delete-id]').forEach((button) => {
        button.addEventListener('click', async (event) => {
          event.stopPropagation()
          const menuId = button.dataset.deleteId
          if (!menuId) return
          const menu = menus.find((m) => m.id === menuId)
          if (!menu) return

          // Vor dem Löschen prüfen, ob das Menü noch geloggt ist — danach
          // zeigt der betroffene Tag nur noch "Entferntes Menü" an, siehe
          // `referenceUsageService.ts`.
          const usageCount = await countMenuUsage(menuId)
          if (!window.confirm(buildMenuDeleteConfirmMessage(menu.name, usageCount))) return
          await deleteMenu(menuId)
          await renderList()
        })
      })
    }
    bindRowEvents()

    if (showSearch) {
      const searchInput = container.querySelector<HTMLInputElement>('#menu-search')!
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase()
        const filtered =
          query === '' ? menus : menus.filter((menu) => menu.name.toLowerCase().includes(query))
        const listEl = container.querySelector<HTMLUListElement>('[data-list]')!
        listEl.innerHTML =
          filtered.length === 0
            ? '<li class="recipe-list__status">Keine Menüs gefunden.</li>'
            : renderItems(filtered)
        bindRowEvents()
      })
    }

    container.querySelector('[data-action="create"]')?.addEventListener('click', onCreateNew)
    container.querySelector('[data-action="back"]')?.addEventListener('click', onBack)

    const importErrorEl = container.querySelector<HTMLParagraphElement>('[data-import-error]')!
    const fileInput = container.querySelector<HTMLInputElement>('[data-file-input]')!

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
        mode = { type: 'import' }
        renderImport(result.data)
      })()
    })
  }

  function renderImport(data: BackupData): void {
    const localCustomFoods = getCustomFoods()
    const sortedMenus = [...data.menus].sort((a, b) => a.name.localeCompare(b.name, 'de'))

    renderImportSelection({
      container,
      title: 'Menüs aus Backup-Datei importieren',
      emptyMessage: 'Die Backup-Datei enthält keine Menüs.',
      items: sortedMenus.map((menu) => {
        const missingHint = describeMissingIngredients(menu, data, localCustomFoods)
        return {
          id: menu.id,
          label: menu.name,
          description: missingHint
            ? `${formatDate(menu.createdAt)} · ${missingHint}`
            : formatDate(menu.createdAt),
        }
      }),
      confirmLabel: 'Ausgewählte Menüs importieren',
      onConfirm: async (selectedIds) => {
        const selectedMenus = data.menus.filter((menu) => selectedIds.includes(menu.id))

        const { foods: neededFoods } = resolveReferencedCustomFoods(
          selectedMenus,
          data.customFoods,
          localCustomFoods,
        )
        const foodMerge = mergeImportedItems(localCustomFoods, neededFoods, generateCustomFoodId)
        saveCustomFoods(foodMerge.items)

        const remappedMenus = selectedMenus.map((menu) =>
          remapMenuIngredients(menu, foodMerge.idRemap),
        )
        const existingMenus = await getAllMenus()
        const menuMerge = mergeImportedItems(existingMenus, remappedMenus, () =>
          crypto.randomUUID(),
        )
        for (const menu of menuMerge.items.slice(existingMenus.length)) {
          await saveMenu(menu)
        }

        mode = { type: 'list', status: buildImportStatusMessage(menuMerge, foodMerge) }
        await renderList()
      },
      onCancel: () => {
        mode = { type: 'list' }
        void renderList()
      },
    })
  }

  container.innerHTML = `
    <section class="recipe-list">
      <h1 class="type-heading-menu">Eigene Menüs</h1>
      <p class="recipe-list__status">Lade Menüs…</p>
    </section>
  `
  await renderList()
}
