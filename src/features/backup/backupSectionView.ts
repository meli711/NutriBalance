import { downloadBackup, importBackup, parseBackupJson } from './backupService.ts'
import { isStoragePersisted } from '../../app/storagePersistence.ts'

export interface BackupSectionOptions {
  /** Element, in das der Backup-Abschnitt angehängt wird (nicht ersetzt). */
  container: HTMLElement
  /** Aufgerufen kurz nach erfolgreichem Import, damit z.B. zum Log-Screen mit den neuen Daten navigiert werden kann. */
  onImported: () => void
}

const CONFIRM_IMPORT_MESSAGE =
  'Dadurch werden alle aktuell gespeicherten Daten (Profil, Menüs, Log-Einträge) durch die ' +
  'Daten aus der Backup-Datei ersetzt. Fortfahren?'

function setStatus(el: HTMLParagraphElement, message: string, isError: boolean): void {
  el.textContent = message
  el.className = isError ? 'field-error' : 'recipe-detail__note'
  el.hidden = false
}

export function renderBackupSection(options: BackupSectionOptions): void {
  const { container, onImported } = options

  const section = document.createElement('section')
  section.className = 'backup-section'
  section.innerHTML = `
    <h2>Daten-Backup</h2>
    <p class="profile-view__meta">
      Deine Daten werden nur lokal auf diesem Gerät gespeichert. Erstelle regelmässig ein
      Backup, falls du den Browser-Cache leerst oder das Gerät wechselst.
    </p>
    <p class="backup-section__hint" data-persist-hint hidden></p>
    <div class="profile-view__actions">
      <button type="button" class="button-secondary" data-action="export">Daten sichern</button>
      <button type="button" class="button-secondary" data-action="import">Daten wiederherstellen</button>
    </div>
    <input type="file" accept=".json,application/json" data-file-input hidden />
    <p class="recipe-detail__note" data-status hidden></p>
  `
  container.appendChild(section)

  const statusEl = section.querySelector<HTMLParagraphElement>('[data-status]')
  const fileInput = section.querySelector<HTMLInputElement>('[data-file-input]')
  const persistHint = section.querySelector<HTMLParagraphElement>('[data-persist-hint]')

  if (persistHint) {
    void isStoragePersisted().then((persisted) => {
      if (persisted === null) return // nicht unterstützt/ermittelbar — kein Hinweis nötig
      persistHint.textContent = persisted
        ? 'Persistenter Speicher ist für diese App aktiv.'
        : 'Persistenter Speicher ist derzeit nicht aktiv.'
      persistHint.hidden = false
    })
  }

  section.querySelector('[data-action="export"]')?.addEventListener('click', () => {
    if (!statusEl) return
    downloadBackup()
      .then(() => setStatus(statusEl, 'Backup heruntergeladen.', false))
      .catch(() => setStatus(statusEl, 'Backup konnte nicht erstellt werden.', true))
  })

  section.querySelector('[data-action="import"]')?.addEventListener('click', () => {
    fileInput?.click()
  })

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    fileInput.value = '' // erlaubt erneute Auswahl derselben Datei
    if (!file || !statusEl) return

    void (async () => {
      const raw = await file.text()
      const result = parseBackupJson(raw)
      if (!result.ok) {
        setStatus(statusEl, result.error, true)
        return
      }

      if (!window.confirm(CONFIRM_IMPORT_MESSAGE)) return

      try {
        await importBackup(result.data)
        setStatus(statusEl, 'Daten erfolgreich wiederhergestellt.', false)
        setTimeout(onImported, 1200)
      } catch {
        setStatus(statusEl, 'Import fehlgeschlagen. Bitte erneut versuchen.', true)
      }
    })()
  })
}
