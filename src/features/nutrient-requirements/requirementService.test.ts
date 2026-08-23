import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findAgeGroup, getRequirementsForProfile } from './requirementService.ts'
import type { UserProfile } from '../../data/models/userProfile.ts'

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

test('getRequirementsForProfile liefert Makro- und Kern-Mikronährstoffe für ein Profil', () => {
  const profile: UserProfile = {
    age: 17,
    heightCm: 170,
    gender: 'female',
  }

  const requirements = getRequirementsForProfile(profile)
  const nutrientIds = requirements.map((r) => r.nutrientId).sort()

  assert.deepEqual(nutrientIds, [
    'calcium',
    'carbohydrates',
    'energy',
    'fat',
    'fiber',
    'iron',
    'protein',
    'vitaminC',
  ])

  const energy = requirements.find((r) => r.nutrientId === 'energy')
  assert.equal(energy?.recommended, 2300) // 15-19, weiblich, PAL 1.6

  const protein = requirements.find((r) => r.nutrientId === 'protein')
  assert.equal(protein?.recommended, 48)

  const calcium = requirements.find((r) => r.nutrientId === 'calcium')
  assert.equal(calcium?.recommended, 1200) // 15-19: erhöhter Wert

  const iron = requirements.find((r) => r.nutrientId === 'iron')
  assert.equal(iron?.recommended, 16) // 15-19, weiblich

  const vitaminC = requirements.find((r) => r.nutrientId === 'vitaminC')
  assert.equal(vitaminC?.recommended, 90) // 15-19, weiblich
})

test('getRequirementsForProfile bildet die Eisen-Prä-/Postmenopause-Näherung altersbasiert ab', () => {
  const youngerWoman: UserProfile = { age: 45, heightCm: 165, gender: 'female' }
  const olderWoman: UserProfile = { age: 60, heightCm: 165, gender: 'female' }

  const youngerIron = getRequirementsForProfile(youngerWoman).find((r) => r.nutrientId === 'iron')
  const olderIron = getRequirementsForProfile(olderWoman).find((r) => r.nutrientId === 'iron')

  assert.equal(youngerIron?.recommended, 16)
  assert.equal(olderIron?.recommended, 14)
})

test('getRequirementsForProfile unterscheidet nach Geschlecht bei gleichem Alter', () => {
  const female: UserProfile = { age: 30, heightCm: 165, gender: 'female' }
  const male: UserProfile = { age: 30, heightCm: 180, gender: 'male' }

  const femaleEnergy = getRequirementsForProfile(female).find((r) => r.nutrientId === 'energy')
  const maleEnergy = getRequirementsForProfile(male).find((r) => r.nutrientId === 'energy')

  assert.equal(femaleEnergy?.recommended, 2100)
  assert.equal(maleEnergy?.recommended, 2700)
})

test('getRequirementsForProfile wendet manuelle Overrides auf den empfohlenen Wert an', () => {
  const profile: UserProfile = { age: 30, heightCm: 165, gender: 'female' }

  const requirements = getRequirementsForProfile(profile, { energy: 1800, protein: 70 })

  const energy = requirements.find((r) => r.nutrientId === 'energy')
  assert.equal(energy?.recommended, 1800)
  assert.equal(energy?.isOverridden, true)

  const protein = requirements.find((r) => r.nutrientId === 'protein')
  assert.equal(protein?.recommended, 70)
  assert.equal(protein?.isOverridden, true)

  const calcium = requirements.find((r) => r.nutrientId === 'calcium')
  assert.equal(calcium?.isOverridden, undefined)
})

test('getRequirementsForProfile ignoriert Overrides für Nährstoffe ohne recommended-Wert', () => {
  const profile: UserProfile = { age: 30, heightCm: 165, gender: 'female' }

  const requirements = getRequirementsForProfile(profile, { fiber: 999 })
  const fiber = requirements.find((r) => r.nutrientId === 'fiber')

  assert.equal(fiber?.recommended, undefined)
  assert.equal(fiber?.isOverridden, undefined)
})
