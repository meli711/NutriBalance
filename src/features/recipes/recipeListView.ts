import { getAllRecipes } from './recipeService.ts'
import type { Recipe } from './models/recipe.ts'
import { getMealCategory, renderMealCategoryIcon } from '../../utils/mealCategoryIcon.ts'

export interface RecipeListViewOptions {
  container: HTMLElement
  onSelectRecipe: (recipeId: string) => void
  onBack: () => void
}

export async function renderRecipeListView(options: RecipeListViewOptions): Promise<void> {
  const { container, onSelectRecipe, onBack } = options

  container.innerHTML = `
    <section class="recipe-list">
      <h1 class="type-heading-recipe">Rezepte</h1>
      <p class="recipe-list__status">Lade Rezepte…</p>
    </section>
  `

  let recipes: Recipe[]
  try {
    recipes = await getAllRecipes()
  } catch {
    const status = container.querySelector('.recipe-list__status')
    if (status) status.textContent = 'Rezepte konnten nicht geladen werden.'
    return
  }

  recipes = [...recipes].sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const showSearch = recipes.length > 10

  function renderItems(list: Recipe[]): string {
    return list
      .map((recipe) => {
        const category = getMealCategory(recipe.id)
        return `
          <li>
            <button type="button" class="recipe-list__item" data-recipe-id="${recipe.id}">
              <span class="recipe-list__label">
                ${category ? `<span class="recipe-list__icon">${renderMealCategoryIcon(category)}</span>` : ''}
                <span class="recipe-list__name">${recipe.name}</span>
              </span>
            </button>
          </li>`
      })
      .join('')
  }

  container.innerHTML = `
    <section class="recipe-list">
      <h1 class="type-heading-recipe">Rezepte</h1>
      ${
        showSearch
          ? `<div class="field recipe-list__search">
               <input id="recipe-search" type="text" autocomplete="off" placeholder="Name eingeben" aria-label="Rezepte durchsuchen" />
             </div>`
          : ''
      }
      <ul class="recipe-list__items" data-list>${renderItems(recipes)}</ul>
      <div class="recipe-list__actions">
        <button type="button" class="button-secondary" data-action="back">Zurück</button>
      </div>
    </section>
  `

  const listEl = container.querySelector<HTMLUListElement>('[data-list]')!

  function bindItemClicks(): void {
    listEl.querySelectorAll<HTMLButtonElement>('[data-recipe-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const recipeId = button.dataset.recipeId
        if (recipeId) onSelectRecipe(recipeId)
      })
    })
  }
  bindItemClicks()

  if (showSearch) {
    const searchInput = container.querySelector<HTMLInputElement>('#recipe-search')!
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

  container.querySelector('[data-action="back"]')?.addEventListener('click', onBack)
}
