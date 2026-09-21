import { getAllRecipes } from '../recipes/recipeService.ts'
import type { Recipe } from '../recipes/models/recipe.ts'
import { addLogEntry, getAllMenus } from '../../data/indexedDbService.ts'
import type { Menu } from '../menu-builder/models/menu.ts'
import { renderFoodPicker } from '../shared/foodPickerControl.ts'

export interface AddLogEntryViewOptions {
  container: HTMLElement
  date: string
  onAdded: () => void
  onCancel: () => void
}

type Tab = 'recipe' | 'menu' | 'food'

const TAB_LABELS: Record<Tab, string> = {
  recipe: 'Rezept',
  menu: 'Menü',
  food: 'Zutat',
}

export function renderAddLogEntryView(options: AddLogEntryViewOptions): void {
  const { container, date, onAdded, onCancel } = options

  container.innerHTML = `
    <section class="daily-log">
      <h1>Eintrag hinzufügen</h1>

      <div class="nutrient-chart__toggle" role="group" aria-label="Art des Eintrags wählen">
        ${(['food', 'menu', 'recipe'] as Tab[])
          .map(
            (tab, index) => `
              <button
                type="button"
                class="nutrient-chart__toggle-btn${index === 0 ? ' is-active' : ''}"
                data-tab="${tab}"
                aria-pressed="${index === 0}"
              >${TAB_LABELS[tab]}</button>`,
          )
          .join('')}
      </div>

      <div data-tab-content></div>

      <button type="button" class="button-secondary" data-action="cancel">Abbrechen</button>
    </section>
  `

  const tabContent = container.querySelector<HTMLDivElement>('[data-tab-content]')!
  const tabButtons = container.querySelectorAll<HTMLButtonElement>('[data-tab]')

  function activateTab(tab: Tab): void {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tab
      button.classList.toggle('is-active', isActive)
      button.setAttribute('aria-pressed', String(isActive))
    })
    if (tab === 'recipe') void renderRecipeTab()
    else if (tab === 'menu') void renderMenuTab()
    else renderFoodTab()
  }

  async function renderRecipeTab(): Promise<void> {
    tabContent.innerHTML = `<p class="recipe-list__status">Lade Rezepte…</p>`
    let recipes: Recipe[]
    try {
      recipes = await getAllRecipes()
    } catch {
      tabContent.innerHTML = `<p class="field-error" role="alert">Rezepte konnten nicht geladen werden.</p>`
      return
    }

    recipes = [...recipes].sort((a, b) => a.name.localeCompare(b.name, 'de'))
    const showSearch = recipes.length > 10

    function renderItems(list: typeof recipes): string {
      return list
        .map(
          (recipe) => `
            <li>
              <button type="button" class="recipe-list__item" data-recipe-id="${recipe.id}">
                <span class="recipe-list__name">${recipe.name}</span>
              </button>
            </li>`,
        )
        .join('')
    }

    tabContent.innerHTML = `
      ${
        showSearch
          ? `<div class="field recipe-list__search">
               <input id="log-recipe-search" type="text" autocomplete="off" placeholder="Name eingeben" aria-label="Rezepte durchsuchen" />
             </div>`
          : ''
      }
      <ul class="recipe-list__items" data-list>${renderItems(recipes)}</ul>
    `

    const listEl = tabContent.querySelector<HTMLUListElement>('[data-list]')!

    function bindItemClicks(): void {
      listEl.querySelectorAll<HTMLButtonElement>('[data-recipe-id]').forEach((button) => {
        button.addEventListener('click', () => {
          const recipeId = button.dataset.recipeId
          if (!recipeId) return

          // Direkt mit Default-Werten hinzufügen (kein Prompt-Popup) — der
          // Faktor lässt sich danach im Log direkt anpassen (Instruktion 15).
          void addLogEntry({
            id: crypto.randomUUID(),
            date,
            type: 'recipe',
            recipeId,
            factor: 1,
          }).then(onAdded)
        })
      })
    }
    bindItemClicks()

    if (showSearch) {
      const searchInput = tabContent.querySelector<HTMLInputElement>('#log-recipe-search')!
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase()
        const filtered =
          query === ''
            ? recipes
            : recipes.filter((recipe) => recipe.name.toLowerCase().includes(query))
        listEl.innerHTML =
          filtered.length === 0
            ? '<li class="recipe-list__status">Keine Rezepte gefunden.</li>'
            : renderItems(filtered)
        bindItemClicks()
      })
    }
  }

  async function renderMenuTab(): Promise<void> {
    tabContent.innerHTML = `<p class="recipe-list__status">Lade Menüs…</p>`
    let menus: Menu[]
    try {
      menus = await getAllMenus()
    } catch {
      tabContent.innerHTML = `<p class="field-error" role="alert">Menüs konnten nicht geladen werden.</p>`
      return
    }

    if (menus.length === 0) {
      tabContent.innerHTML = `<p class="recipe-list__status">Noch keine eigenen Menüs gespeichert.</p>`
      return
    }

    menus = [...menus].sort((a, b) => a.name.localeCompare(b.name, 'de'))
    const showSearch = menus.length > 10

    function renderItems(list: typeof menus): string {
      return list
        .map(
          (menu) => `
            <li>
              <button type="button" class="recipe-list__item" data-menu-id="${menu.id}">
                <span class="recipe-list__name">${menu.name}</span>
              </button>
            </li>`,
        )
        .join('')
    }

    tabContent.innerHTML = `
      ${
        showSearch
          ? `<div class="field recipe-list__search">
               <input id="log-menu-search" type="text" autocomplete="off" placeholder="Name eingeben" aria-label="Menüs durchsuchen" />
             </div>`
          : ''
      }
      <ul class="recipe-list__items" data-list>${renderItems(menus)}</ul>
    `

    const listEl = tabContent.querySelector<HTMLUListElement>('[data-list]')!

    function bindItemClicks(): void {
      listEl.querySelectorAll<HTMLButtonElement>('[data-menu-id]').forEach((button) => {
        button.addEventListener('click', () => {
          const menuId = button.dataset.menuId
          if (!menuId) return
          void addLogEntry({
            id: crypto.randomUUID(),
            date,
            type: 'menu',
            menuId,
            factor: 1,
          }).then(onAdded)
        })
      })
    }
    bindItemClicks()

    if (showSearch) {
      const searchInput = tabContent.querySelector<HTMLInputElement>('#log-menu-search')!
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase()
        const filtered =
          query === '' ? menus : menus.filter((menu) => menu.name.toLowerCase().includes(query))
        listEl.innerHTML =
          filtered.length === 0
            ? '<li class="recipe-list__status">Keine Menüs gefunden.</li>'
            : renderItems(filtered)
        bindItemClicks()
      })
    }
  }

  function renderFoodTab(): void {
    tabContent.innerHTML = ''
    renderFoodPicker({
      container: tabContent,
      addButtonLabel: 'Zum Log hinzufügen',
      onAdd: (food, amountGrams) => {
        void addLogEntry({
          id: crypto.randomUUID(),
          date,
          type: 'food',
          foodId: food.id,
          amountGrams,
          factor: 1,
        }).then(onAdded)
      },
    })
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab as Tab | undefined
      if (tab) activateTab(tab)
    })
  })

  container.querySelector('[data-action="cancel"]')?.addEventListener('click', onCancel)

  activateTab('food')
}
