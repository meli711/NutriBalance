import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AGE_MAX,
  AGE_MIN,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  validateProfileInput,
} from './profileForm.ts'

test('validateProfileInput akzeptiert gültige Werte', () => {
  assert.equal(validateProfileInput(30, 'female', 170), null)
  assert.equal(validateProfileInput(AGE_MIN, 'male', HEIGHT_MIN_CM), null)
  assert.equal(validateProfileInput(AGE_MAX, 'male', HEIGHT_MAX_CM), null)
})

test('validateProfileInput lehnt Alter ausserhalb 10–100 ab', () => {
  assert.match(validateProfileInput(AGE_MIN - 1, 'female', 170) ?? '', /Alter/)
  assert.match(validateProfileInput(AGE_MAX + 1, 'female', 170) ?? '', /Alter/)
  assert.match(validateProfileInput(Number.NaN, 'female', 170) ?? '', /Alter/)
})

test('validateProfileInput verlangt ein gültiges Geschlecht', () => {
  assert.match(validateProfileInput(30, undefined, 170) ?? '', /Geschlecht/)
  assert.match(validateProfileInput(30, 'divers', 170) ?? '', /Geschlecht/)
})

test('validateProfileInput lehnt Grösse ausserhalb 100–230cm ab', () => {
  assert.match(validateProfileInput(30, 'male', HEIGHT_MIN_CM - 1) ?? '', /Grösse/)
  assert.match(validateProfileInput(30, 'male', HEIGHT_MAX_CM + 1) ?? '', /Grösse/)
})
