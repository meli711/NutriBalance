import { getAllRecipes } from './recipeService.ts'
import type { Recipe } from './models/recipe.ts'

export interface RecipeListViewOptions {
  container: HTMLElement
  onSelectRecipe: (recipeId: string) => void
  onBack: () => void
}

export async function renderRecipeListView(options: RecipeListViewOptions): Promise<void> {
  const { container, onSelectRecipe, onBack } = options

  container.innerHTML = `
    <main>
      <section class="recipe-list">
        <h1>Rezepte</h1>
        <p class="recipe-list__status">Lade Rezepte…</p>
      </section>
    </main>
  `

  let recipes: Recipe[]
  try {
    recipes = await getAllRecipes()
  } catch {
    const status = container.querySelector('.recipe-list__status')
    if (status) status.textContent = 'Rezepte konnten nicht geladen werden.'
    return
  }

  const items = recipes
    .map(
      (recipe) => `
        <li>
          <button type="button" class="recipe-list__item" data-recipe-id="${recipe.id}">
            <span class="recipe-list__name">${recipe.name}</span>
            <span class="recipe-list__servings">${recipe.servings} Portion${recipe.servings === 1 ? '' : 'en'}</span>
          </button>
        </li>`,
    )
    .join('')

  container.innerHTML = `
    <main>
      <section class="recipe-list">
        <h1>Rezepte</h1>
        <ul class="recipe-list__items">${items}</ul>
        <button type="button" class="button-secondary" data-action="back">Zurück</button>
      </section>
    </main>
  `

  container.querySelectorAll<HTMLButtonElement>('[data-recipe-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const recipeId = button.dataset.recipeId
      if (recipeId) onSelectRecipe(recipeId)
    })
  })

  container.querySelector('[data-action="back"]')?.addEventListener('click', onBack)
}
