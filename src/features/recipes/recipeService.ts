import type { Recipe } from './models/recipe.ts'

const RECIPES_URL = '/data/recipes.json'

let cache: Recipe[] | null = null
let loadPromise: Promise<Recipe[]> | null = null

async function loadRecipes(): Promise<Recipe[]> {
  if (cache) return cache
  if (!loadPromise) {
    loadPromise = fetch(RECIPES_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Rezepte konnten nicht geladen werden: ${res.status}`)
        }
        return res.json() as Promise<Recipe[]>
      })
      .then((recipes) => {
        cache = recipes
        return recipes
      })
  }
  return loadPromise
}

export async function getAllRecipes(): Promise<Recipe[]> {
  return loadRecipes()
}

export async function getRecipeById(id: string): Promise<Recipe | undefined> {
  const recipes = await loadRecipes()
  return recipes.find((recipe) => recipe.id === id)
}
