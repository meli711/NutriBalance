import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDaysToDateString,
  formatDateLabel,
  formatShortDateLabel,
  getDateRange,
  getLocalDateString,
  isFutureDateString,
} from './date.ts'

test('getLocalDateString liefert das lokale Datum, nicht UTC', () => {
  // 22.08.2026, 14:30 Uhr lokal — eindeutig kein Mitternachts-Grenzfall.
  assert.equal(getLocalDateString(new Date(2026, 7, 22, 14, 30)), '2026-08-22')
})

test('getLocalDateString: Grenzfall nahe Mitternacht bleibt beim lokalen Kalendertag', () => {
  // 22.08.2026, 23:59 Uhr lokal → lokal gesehen noch der 22., nicht der 23.
  // (mit new Date(...).toISOString() würde das je nach Zeitzone auf den
  // 23. UTC "kippen" — genau das soll hier NICHT passieren.)
  const lateNight = new Date(2026, 7, 22, 23, 59, 59)
  assert.equal(getLocalDateString(lateNight), '2026-08-22')

  // 23.08.2026, 00:00:01 Uhr lokal → eine Sekunde später ist es lokal
  // bereits der nächste Tag.
  const justAfterMidnight = new Date(2026, 7, 23, 0, 0, 1)
  assert.equal(getLocalDateString(justAfterMidnight), '2026-08-23')
})

test('getLocalDateString füllt Monat/Tag mit führender Null auf', () => {
  assert.equal(getLocalDateString(new Date(2026, 0, 5)), '2026-01-05')
})

test('addDaysToDateString rechnet über Monats-/Jahresgrenzen korrekt', () => {
  assert.equal(addDaysToDateString('2026-08-22', -1), '2026-08-21')
  assert.equal(addDaysToDateString('2026-08-22', 1), '2026-08-23')
  assert.equal(addDaysToDateString('2026-01-01', -1), '2025-12-31')
  assert.equal(addDaysToDateString('2026-02-28', 1), '2026-03-01') // 2026 ist kein Schaltjahr
})

test('isFutureDateString erkennt Tage nach heute (relativ zum echten "heute", kein Date-Mocking nötig)', () => {
  const today = getLocalDateString(new Date())
  const tomorrow = addDaysToDateString(today, 1)
  const yesterday = addDaysToDateString(today, -1)

  assert.equal(isFutureDateString(tomorrow), true)
  assert.equal(isFutureDateString(today), false)
  assert.equal(isFutureDateString(yesterday), false)
})

test('formatDateLabel markiert das heutige Datum als "Heute"', () => {
  const today = getLocalDateString(new Date())
  const yesterday = addDaysToDateString(today, -1)

  assert.match(formatDateLabel(today), /^Heute,/)
  assert.doesNotMatch(formatDateLabel(yesterday), /^Heute,/)
})

test('getDateRange liefert aufsteigende lokale Datums-Strings, endet auf endDateStr', () => {
  assert.deepEqual(getDateRange('2026-09-07', 7), [
    '2026-09-01',
    '2026-09-02',
    '2026-09-03',
    '2026-09-04',
    '2026-09-05',
    '2026-09-06',
    '2026-09-07',
  ])
})

test('getDateRange rechnet über eine Monatsgrenze hinweg korrekt', () => {
  const range = getDateRange('2026-03-02', 4)
  assert.deepEqual(range, ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'])
  assert.equal(range.length, 4)
  assert.equal(range[range.length - 1], '2026-03-02')
})

test('formatShortDateLabel: Wochentag-Kürzel + Tag.Monat., lokal (kein Mitternachts-Kippen)', () => {
  // 2026-09-07 ist ein Montag.
  assert.match(formatShortDateLabel('2026-09-07'), /^Mo 7\.9\.$/)
  // 2026-01-05 ist ein Montag, einstellige Werte ohne führende Null.
  assert.match(formatShortDateLabel('2026-01-05'), /^Mo 5\.1\.$/)
})
