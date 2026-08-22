import type { Recipe, RecipeIngredient } from '../recipes/models/recipe.ts'
import type { Menu } from './models/menu.ts'

/** Slug aus dem Menü-Namen (Umlaute transliteriert, kein Sonderzeichen-Chaos in der ID). */
function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'menu'
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6)
}

/**
 * Erzeugt eine ID aus Slug + Zeit-/Zufalls-Suffix (kollidiert praktisch nie
 * bei wiederholten Aufrufen, auch mit identischem Namen) und prüft
 * zusätzlich explizit gegen `existingIds` (die IDs aus der aktuell
 * geladenen recipes.json) — falls doch einmal eine Kollision auftritt, wird
 * neu gewürfelt statt eine doppelte ID zu vergeben.
 */
export function generateUniqueRecipeId(name: string, existingIds: readonly string[] = []): string {
  const slug = slugify(name)
  const existing = new Set(existingIds)

  let candidate = `${slug}-${Date.now().toString(36)}-${randomSuffix()}`
  while (existing.has(candidate)) {
    candidate = `${slug}-${Date.now().toString(36)}-${randomSuffix()}`
  }
  return candidate
}

/**
 * Wandelt ein gespeichertes Menü in ein `Recipe` um, wie es in `recipes.json`
 * (Instruktion 4) stehen würde. `instructions` bleibt bewusst weg (optional,
 * kann später manuell in der JSON-Datei ergänzt werden).
 *
 * `existingIds` ist optional (Default: `[]`) — eine kleine, abwärtskompatible
 * Erweiterung der im Auftrag skizzierten Signatur `menuToRecipe(menu,
 * servings)`, weil die geforderte Kollisionsprüfung gegen die aktuell
 * geladene recipes.json sonst nicht möglich wäre.
 */
export function menuToRecipe(
  menu: Menu,
  servings: number,
  existingIds: readonly string[] = [],
): Recipe {
  const ingredients: RecipeIngredient[] = menu.ingredients.map(({ foodId, amountGrams }) => ({
    foodId,
    amountGrams,
  }))

  return {
    id: generateUniqueRecipeId(menu.name, existingIds),
    name: menu.name,
    servings,
    ingredients,
  }
}

function isValidRecipeIngredient(value: unknown): value is RecipeIngredient {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.foodId === 'string' &&
    typeof v.amountGrams === 'number' &&
    Number.isFinite(v.amountGrams)
  )
}

/**
 * Strukturelle Validierung gegen das bestehende `Recipe`-Schema (Instruktion
 * 4) — genutzt sowohl für den Export (neu erzeugtes Recipe prüfen) als auch
 * defensiv beim Laden der aktuellen recipes.json vor dem Anhängen.
 */
export function isValidRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.name === 'string' &&
    typeof v.servings === 'number' &&
    Number.isFinite(v.servings) &&
    v.servings > 0 &&
    Array.isArray(v.ingredients) &&
    v.ingredients.length > 0 &&
    v.ingredients.every(isValidRecipeIngredient) &&
    (v.instructions === undefined ||
      (Array.isArray(v.instructions) && v.instructions.every((s) => typeof s === 'string')))
  )
}

export function isValidRecipeArray(value: unknown): value is Recipe[] {
  return Array.isArray(value) && value.every(isValidRecipe)
}
