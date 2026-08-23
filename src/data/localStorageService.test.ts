import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStoredProfile, parseStoredRequirementOverrides } from './localStorageService.ts'

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
