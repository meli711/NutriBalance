import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStoredProfile } from './localStorageService.ts'

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
