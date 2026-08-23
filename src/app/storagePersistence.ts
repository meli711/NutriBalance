/**
 * Best-effort: reduziert das Risiko, dass der Browser bei Speicherdruck
 * automatisch Daten löscht. Kein Ersatz fürs Backup (Instruktion 10) —
 * Feature-Detection, da nicht jeder Browser die Storage API unterstützt.
 * Ergebnis (gewährt/abgelehnt/nicht unterstützt) wird bewusst nicht als
 * Fehler behandelt und blockiert den App-Start nicht.
 */
export async function requestPersistentStorage(): Promise<void> {
  if (!navigator.storage?.persist) return
  try {
    await navigator.storage.persist()
  } catch {
    // best-effort, kein kritischer Fehler
  }
}

/** `null` = nicht ermittelbar (nicht unterstützt oder Fehler) — nur informativ zu verwenden. */
export async function isStoragePersisted(): Promise<boolean | null> {
  if (!navigator.storage?.persisted) return null
  try {
    return await navigator.storage.persisted()
  } catch {
    return null
  }
}
