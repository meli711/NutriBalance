import { deleteMenu, getAllMenus } from '../../data/indexedDbService.ts'
import { buildMenuDeleteConfirmMessage, countMenuUsage } from '../shared/referenceUsageService.ts'
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

export async function renderMenuListView(options: MenuListViewOptions): Promise<void> {
  const { container, onSelectMenu, onCreateNew, onBack } = options

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

    container.innerHTML = `
      <section class="recipe-list">
        <h1 class="type-heading-menu">Eigene Menüs</h1>
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
          <button type="button" class="button-secondary" data-action="back">Zurück</button>
        </div>
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
        const filtered = query === '' ? menus : menus.filter((menu) => menu.name.toLowerCase().includes(query))
        const listEl = container.querySelector<HTMLUListElement>('[data-list]')!
        listEl.innerHTML =
          filtered.length === 0 ? '<li class="recipe-list__status">Keine Menüs gefunden.</li>' : renderItems(filtered)
        bindRowEvents()
      })
    }

    container.querySelector('[data-action="create"]')?.addEventListener('click', onCreateNew)
    container.querySelector('[data-action="back"]')?.addEventListener('click', onBack)
  }

  container.innerHTML = `
    <section class="recipe-list">
      <h1 class="type-heading-menu">Eigene Menüs</h1>
      <p class="recipe-list__status">Lade Menüs…</p>
    </section>
  `
  await renderList()
}
