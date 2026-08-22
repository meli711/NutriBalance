import type { FoodItem } from './models/food.ts'

// `import.meta.env.BASE_URL` statt eines fest verdrahteten "/", damit ein
// Deployment in einem Unterordner (z.B. via `vite build --base=/pfad/`)
// funktioniert, nicht nur im Domain-Root. `?? '/'` als Fallback, da
// `import.meta.env` ausserhalb von Vite (z.B. beim reinen `node --test`,
// wenn ein Test dieses Modul transitiv importiert, ohne fetch tatsächlich
// aufzurufen) nicht existiert.
const DATABASE_URL = `${import.meta.env?.BASE_URL ?? '/'}data/food-database.json`

let cache: FoodItem[] | null = null
let loadPromise: Promise<FoodItem[]> | null = null

async function loadDatabase(): Promise<FoodItem[]> {
  if (cache) return cache
  if (!loadPromise) {
    loadPromise = fetch(DATABASE_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Nährwertdatenbank konnte nicht geladen werden: ${res.status}`)
        }
        return res.json() as Promise<FoodItem[]>
      })
      .then((foods) => {
        cache = foods
        return foods
      })
  }
  return loadPromise
}

export async function getAllFoods(): Promise<FoodItem[]> {
  return loadDatabase()
}

export async function getFoodById(id: string): Promise<FoodItem | undefined> {
  const foods = await loadDatabase()
  return foods.find((food) => food.id === id)
}

export async function searchFoodsByName(query: string): Promise<FoodItem[]> {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  const foods = await loadDatabase()
  return foods.filter((food) => {
    if (food.name.de.toLowerCase().includes(normalizedQuery)) return true
    return (
      food.synonyms?.some((synonym) => synonym.toLowerCase().includes(normalizedQuery)) ?? false
    )
  })
}
