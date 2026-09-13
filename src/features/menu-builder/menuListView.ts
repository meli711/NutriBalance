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

  async function renderList(): Promise<void> {
    let menus: Menu[]
    try {
      menus = await getAllMenus()
    } catch {
      container.innerHTML = `
        <section class="recipe-list">
          <h1>Eigene Menüs</h1>
          <p class="field-error" role="alert">Menüs konnten nicht geladen werden.</p>
          <button type="button" class="button-secondary" data-action="back">Zurück</button>
        </section>
      `
      container.querySelector('[data-action="back"]')?.addEventListener('click', onBack)
      return
    }

    const items = menus
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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

    container.innerHTML = `
      <section class="recipe-list">
        <h1>Eigene Menüs</h1>
        ${
          menus.length === 0
            ? '<p class="recipe-list__status">Noch keine Menüs gespeichert.</p>'
            : `<ul class="recipe-list__items">${items}</ul>`
        }
        <button type="button" class="button-primary" data-action="create">Neues Menü erstellen</button>
        <button type="button" class="button-secondary" data-action="back">Zurück</button>
      </section>
    `

    container.querySelectorAll<HTMLButtonElement>('[data-menu-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const menuId = button.dataset.menuId
        if (menuId) onSelectMenu(menuId)
      })
    })

    container.querySelectorAll<HTMLButtonElement>('[data-delete-id]').forEach((button) => {
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

    container.querySelector('[data-action="create"]')?.addEventListener('click', onCreateNew)
    container.querySelector('[data-action="back"]')?.addEventListener('click', onBack)
  }

  container.innerHTML = `
    <section class="recipe-list">
      <h1>Eigene Menüs</h1>
      <p class="recipe-list__status">Lade Menüs…</p>
    </section>
  `
  await renderList()
}
