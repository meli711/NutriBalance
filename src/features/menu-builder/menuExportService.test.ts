import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateUniqueRecipeId,
  isValidRecipe,
  isValidRecipeArray,
  menuToRecipe,
} from './menuExportService.ts'
import type { Menu } from './models/menu.ts'

function makeMenu(overrides: Partial<Menu> & { name: string }): Menu {
  return {
    id: 'menu-1',
    description: '',
    createdAt: new Date(0).toISOString(),
    ingredients: [{ foodId: '198', amountGrams: 50 }],
    ...overrides,
  }
}

test('menuToRecipe übernimmt Name/Zutaten unverändert, ohne servings (Instruktion 19)', () => {
  const menu = makeMenu({
    name: 'Frühstücksbowl',
    ingredients: [
      { foodId: '198', amountGrams: 50 },
      { foodId: '62', amountGrams: 200 },
    ],
  })

  const recipe = menuToRecipe(menu)

  assert.equal(recipe.name, 'Frühstücksbowl')
  assert.deepEqual(recipe.ingredients, [
    { foodId: '198', amountGrams: 50 },
    { foodId: '62', amountGrams: 200 },
  ])
  assert.equal(typeof recipe.id, 'string')
  assert.ok(recipe.id.length > 0)
  assert.equal(recipe.instructions, undefined)
})

test('menuToRecipe setzt category nur, wenn übergeben (Instruktion 20)', () => {
  const menu = makeMenu({ name: 'Frühstücksbowl' })

  const withCategory = menuToRecipe(menu, [], 'Snack')
  assert.equal(withCategory.category, 'Snack')

  const withoutCategory = menuToRecipe(menu)
  assert.equal(withoutCategory.category, undefined)
  assert.equal('category' in withoutCategory, false) // Feld fehlt komplett, nicht nur undefined-wertig
})

test('menuToRecipe erzeugt bei zwei Menüs mit identischem Namen unterschiedliche IDs', () => {
  const menuA = makeMenu({ id: 'menu-a', name: 'Frühstücksbowl' })
  const menuB = makeMenu({ id: 'menu-b', name: 'Frühstücksbowl' })

  const recipeA = menuToRecipe(menuA)
  // Realer Ablauf: recipeA.id wäre jetzt Teil der aktuell geladenen
  // recipes.json, gegen die der zweite Export prüft.
  const recipeB = menuToRecipe(menuB, [recipeA.id])

  assert.notEqual(recipeA.id, recipeB.id)
})

test('generateUniqueRecipeId erkennt eine echte Kollision und generiert einen neuen Kandidaten (deterministisch erzwungen)', (t) => {
  // Date.now() einfrieren und Math.random() auf eine Sequenz legen, bei der
  // der erste und zweite Aufruf denselben Kandidaten ergeben würden — das
  // erzwingt eine echte Kollision statt sich auf den Zufall zu verlassen.
  t.mock.method(Date, 'now', () => 1_700_000_000_000)
  const randomValues = [0.111111, 0.111111, 0.222222]
  let call = 0
  t.mock.method(Math, 'random', () => randomValues[Math.min(call++, randomValues.length - 1)])

  const first = generateUniqueRecipeId('Kollisionstest')
  const second = generateUniqueRecipeId('Kollisionstest', [first])

  assert.notEqual(first, second)
  assert.ok(
    call >= 3,
    `Math.random sollte für die Kollisionserkennung + Retry mind. 3x aufgerufen werden, war ${call}`,
  )
})

test('isValidRecipe/isValidRecipeArray erkennen eine exportierte Struktur als gültig', () => {
  const menu = makeMenu({ name: 'Testmenü' })
  const recipe = menuToRecipe(menu)

  // Round-Trip durch echtes JSON (wie beim Download), nicht nur das In-Memory-Objekt.
  const roundTripped: unknown = JSON.parse(JSON.stringify(recipe))

  assert.ok(isValidRecipe(roundTripped))
  assert.ok(isValidRecipeArray([roundTripped]))
})

test('isValidRecipe lehnt unvollständige/kaputte Recipe-Objekte ab', () => {
  assert.equal(isValidRecipe(null), false)
  assert.equal(isValidRecipe({}), false)
  assert.equal(isValidRecipe({ id: 'x', name: 'y', ingredients: [] }), false) // keine Zutaten
  assert.equal(
    isValidRecipe({ id: 'x', name: 'y', ingredients: [{ foodId: '1' }] }),
    false, // amountGrams fehlt
  )
})

test('isValidRecipe prüft category nur auf den Typ, nicht gegen MEAL_CATEGORIES (Instruktion 20)', () => {
  const base = { id: 'x', name: 'y', ingredients: [{ foodId: '1', amountGrams: 100 }] }
  assert.equal(isValidRecipe({ ...base, category: 'Snack' }), true)
  // Bewusst lax: eine (noch) unbekannte Kategorie macht das Rezept nicht ungültig.
  assert.equal(isValidRecipe({ ...base, category: 'irgendwas-unbekanntes' }), true)
  assert.equal(isValidRecipe({ ...base, category: 3 }), false) // falscher Typ
})
