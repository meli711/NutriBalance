/**
 * Generische Checkbox-Auswahlliste für den selektiven Import aus einer
 * Backup-Datei (Instruktion 18) — von `ownFoodsPanel.ts` (eigene Zutaten)
 * und `menuListView.ts` (Menüs) gemeinsam genutzt. Reine DOM-View ohne
 * eigenen State-Store, kein `localStorage`-/IndexedDB-Zugriff hier — die
 * eigentliche Merge-Logik steckt in `partialImportService.ts`.
 */
export interface ImportSelectionItem {
  id: string
  label: string
  /** Zweite Zeile pro Eintrag, z.B. Nährwert-Kurzfassung oder Erstellungsdatum + Mitimport-Hinweis. */
  description?: string
}

export interface ImportSelectionOptions {
  container: HTMLElement
  title: string
  /** Text, falls `items` leer ist (die Backup-Datei enthält nichts Passendes). */
  emptyMessage: string
  items: ImportSelectionItem[]
  /** z.B. "Ausgewählte Zutaten importieren". */
  confirmLabel: string
  onConfirm: (selectedIds: string[]) => void
  onCancel: () => void
}

export function renderImportSelection(options: ImportSelectionOptions): void {
  const { container, title, emptyMessage, items, confirmLabel, onConfirm, onCancel } = options

  container.innerHTML = `
    <section class="import-selection">
      <h2>${title}</h2>
      ${
        items.length === 0
          ? `<p class="recipe-list__status">${emptyMessage}</p>`
          : `
            <button type="button" class="import-selection__select-all" data-action="toggle-all">Alle auswählen</button>
            <ul class="recipe-list__items">
              ${items
                .map(
                  (item) => `
                    <li>
                      <label class="import-selection__item">
                        <input type="checkbox" data-item-id="${item.id}" />
                        <span>
                          <span class="recipe-list__name">${item.label}</span>
                          ${item.description ? `<span class="import-selection__description">${item.description}</span>` : ''}
                        </span>
                      </label>
                    </li>`,
                )
                .join('')}
            </ul>
          `
      }
      <div class="recipe-list__actions">
        <button type="button" class="button-primary" data-action="confirm" ${items.length === 0 ? 'disabled' : ''}>${confirmLabel}</button>
        <button type="button" class="button-secondary" data-action="cancel">Abbrechen</button>
      </div>
    </section>
  `

  const checkboxes = container.querySelectorAll<HTMLInputElement>('[data-item-id]')
  const confirmButton = container.querySelector<HTMLButtonElement>('[data-action="confirm"]')!

  function updateConfirmState(): void {
    const anySelected = [...checkboxes].some((checkbox) => checkbox.checked)
    confirmButton.disabled = items.length === 0 || !anySelected
  }
  checkboxes.forEach((checkbox) => checkbox.addEventListener('change', updateConfirmState))
  updateConfirmState()

  const selectAllButton = container.querySelector<HTMLButtonElement>('[data-action="toggle-all"]')
  selectAllButton?.addEventListener('click', () => {
    const allChecked = [...checkboxes].every((checkbox) => checkbox.checked)
    checkboxes.forEach((checkbox) => {
      checkbox.checked = !allChecked
    })
    selectAllButton.textContent = allChecked ? 'Alle auswählen' : 'Alle abwählen'
    updateConfirmState()
  })

  confirmButton.addEventListener('click', () => {
    const selectedIds = [...checkboxes]
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.dataset.itemId!)
    onConfirm(selectedIds)
  })

  container.querySelector('[data-action="cancel"]')?.addEventListener('click', onCancel)
}
