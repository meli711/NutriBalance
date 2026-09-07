import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_HISTORY_SETTINGS,
  parseStoredHistorySettings,
  parseStoredProfile,
  parseStoredRequirementOverrides,
} from './localStorageService.ts'

test('parseStoredProfile gibt null zurück, wenn nichts gespeichert ist', () => {
  assert.equal(parseStoredProfile(null), null)
})

test('parseStoredProfile gibt null zurück bei kaputtem JSON', () => {
  assert.equal(parseStoredProfile('{nicht valides json'), null)
})

test('parseStoredProfile gibt null zurück bei falschen Feldtypen (z.B. manuell editiert)', () => {
  assert.equal(
    parseStoredProfile(JSON.stringify({ age: '30', gender: 'female', heightCm: 170 })),
    null,
  )
  assert.equal(
    parseStoredProfile(JSON.stringify({ age: 30, gender: 'divers', heightCm: 170 })),
    null,
  )
  assert.equal(parseStoredProfile(JSON.stringify({ age: 30, gender: 'female' })), null)
  assert.equal(parseStoredProfile('42'), null)
  assert.equal(parseStoredProfile('null'), null)
})

test('parseStoredProfile akzeptiert ein gültiges Profil', () => {
  const raw = JSON.stringify({ age: 30, gender: 'female', heightCm: 170 })
  assert.deepEqual(parseStoredProfile(raw), { age: 30, gender: 'female', heightCm: 170 })
})

test('parseStoredRequirementOverrides gibt leeres Objekt zurück, wenn nichts gespeichert ist', () => {
  assert.deepEqual(parseStoredRequirementOverrides(null), {})
})

test('parseStoredRequirementOverrides gibt leeres Objekt zurück bei kaputtem/falschem JSON', () => {
  assert.deepEqual(parseStoredRequirementOverrides('{nicht valide'), {})
  assert.deepEqual(parseStoredRequirementOverrides(JSON.stringify({ energy: '1800' })), {})
  assert.deepEqual(parseStoredRequirementOverrides(JSON.stringify([1, 2, 3])), {})
})

test('parseStoredRequirementOverrides akzeptiert gültige Overrides', () => {
  const raw = JSON.stringify({ energy: 1800, protein: 70 })
  assert.deepEqual(parseStoredRequirementOverrides(raw), { energy: 1800, protein: 70 })
})

test('parseStoredHistorySettings gibt den Default zurück, wenn nichts gespeichert ist', () => {
  assert.deepEqual(parseStoredHistorySettings(null), DEFAULT_HISTORY_SETTINGS)
})

test('parseStoredHistorySettings gibt den Default zurück bei kaputtem/falschem JSON', () => {
  assert.deepEqual(parseStoredHistorySettings('{nicht valide'), DEFAULT_HISTORY_SETTINGS)
  assert.deepEqual(parseStoredHistorySettings(JSON.stringify([1, 2, 3])), DEFAULT_HISTORY_SETTINGS)
  assert.deepEqual(parseStoredHistorySettings('42'), DEFAULT_HISTORY_SETTINGS)
})

test('parseStoredHistorySettings filtert unbekannte Nährstoff-IDs heraus', () => {
  const raw = JSON.stringify({ nutrientIds: ['protein', 'unicorn', 'iron'], period: 'month' })
  assert.deepEqual(parseStoredHistorySettings(raw), {
    nutrientIds: ['protein', 'iron'],
    period: 'month',
  })
})

test('parseStoredHistorySettings fällt auf den Default zurück, wenn keine gültige ID übrig bleibt', () => {
  const raw = JSON.stringify({ nutrientIds: ['unicorn', 42], period: 'week' })
  assert.deepEqual(parseStoredHistorySettings(raw), {
    nutrientIds: DEFAULT_HISTORY_SETTINGS.nutrientIds,
    period: 'week',
  })
})

test('parseStoredHistorySettings ersetzt ein ungültiges period durch den Default', () => {
  const raw = JSON.stringify({ nutrientIds: ['protein'], period: 'year' })
  assert.deepEqual(parseStoredHistorySettings(raw), {
    nutrientIds: ['protein'],
    period: DEFAULT_HISTORY_SETTINGS.period,
  })
})
