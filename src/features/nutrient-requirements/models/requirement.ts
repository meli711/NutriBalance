/**
 * Die D-A-CH-Referenzwerte unterscheiden drei Kategorien von Angaben, je
 * nachdem wie gut der tatsächliche Bedarf wissenschaftlich belegt ist:
 * - "empfohleneZufuhr" (empfohlene Zufuhr): gut belegter Bedarf + Sicherheitszuschlag
 * - "schaetzwert" (Schätzwert): Bedarf lässt sich nicht exakt bestimmen
 * - "richtwert" (Richtwert): abgeleitet aus Beobachtungsdaten (z.B. Energie, Fett)
 */
export type DachReferenceType = 'empfohleneZufuhr' | 'schaetzwert' | 'richtwert'

export type { Gender } from '../../../data/models/userProfile.ts'

export interface AgeGroup {
  id: string
  label: string
  /** Jahre, inklusive. */
  minAge: number
  /** Jahre, exklusiv (z.B. 19 = "bis unter 19 Jahre"). `null` = kein oberes Limit. */
  maxAge: number | null
}

/**
 * Referenzwert für einen Nährstoff und eine Alters-/Geschlechtsgruppe.
 * Je nach `referenceType` und Datenlage ist entweder nur `recommended`
 * gesetzt (fester Wert) oder `min`/`max` (Bereich bzw. Mindestwert ohne
 * festen Zielwert, z.B. "≥ 30g Ballaststoffe").
 */
export interface NutrientRequirement {
  nutrientId: string
  unit: string
  referenceType: DachReferenceType
  min?: number
  recommended?: number
  max?: number
  /** Nur gesetzt, wenn die Quelle den Wert pro kg Körpergewicht angibt (z.B. Protein). */
  perKgBodyWeight?: number
  /** Kurzbeleg der Quelle für die schriftliche Arbeit (URL + Abrufdatum). */
  source: string
}
