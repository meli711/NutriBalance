import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findAgeGroup, getRequirementsForProfile } from './requirementService.ts'
import type { UserProfile } from '../../data/localStorageService.ts'

test('findAgeGroup ordnet Alter der richtigen DACH-Gruppe zu', () => {
  assert.equal(findAgeGroup(17).id, '15-19')
  assert.equal(findAgeGroup(19).id, '19-25')
  assert.equal(findAgeGroup(30).id, '25-51')
  assert.equal(findAgeGroup(60).id, '51-65')
  assert.equal(findAgeGroup(70).id, '65+')
})

test('findAgeGroup wirft für nicht abgedeckte Alter (z.B. Kinder < 15)', () => {
  assert.throws(() => findAgeGroup(10))
})

test('getRequirementsForProfile liefert Makronährstoffe für ein Profil', () => {
  const profile: UserProfile = {
    age: 17,
    heightCm: 170,
    gender: 'female',
    selectedNutrients: [],
  }

  const requirements = getRequirementsForProfile(profile)
  const nutrientIds = requirements.map((r) => r.nutrientId).sort()

  assert.deepEqual(nutrientIds, ['carbohydrates', 'energy', 'fat', 'fiber', 'protein'])

  const energy = requirements.find((r) => r.nutrientId === 'energy')
  assert.equal(energy?.recommended, 2300) // 15-19, weiblich, PAL 1.6

  const protein = requirements.find((r) => r.nutrientId === 'protein')
  assert.equal(protein?.recommended, 48)
})

test('getRequirementsForProfile wirft für gender "other" statt einen Wert zu erfinden', () => {
  const profile: UserProfile = {
    age: 25,
    heightCm: 180,
    gender: 'other',
    selectedNutrients: [],
  }

  assert.throws(() => getRequirementsForProfile(profile))
})
