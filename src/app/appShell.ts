import { renderBrandMark } from './brandMark.ts'

/**
 * Persistenter Rahmen (Header/Footer) für alle Screens, siehe DESIGN.md.
 * Wird einmalig beim App-Start gerendert; die bestehenden Screen-Render-
 * Funktionen (Instruktion 3-6) bekommen den zurückgegebenen Content-Slot
 * als `container` statt `#app` direkt — an ihrer eigenen Logik ändert sich
 * dadurch nichts, sie verlieren nur ihr eigenes `<main>`-Tag (jetzt hier
 * zentral, damit pro Seite nur ein `<main>`-Landmark existiert).
 */
export function renderAppShell(root: HTMLElement): HTMLElement {
  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div class="app-header__brand">
          ${renderBrandMark(36)}
          <p class="app-header__wordmark">Meliane's <strong>NutriBalance</strong></p>
        </div>
      </header>
      <main id="screen-content" class="app-content"></main>
      <footer class="app-footer">
        <div class="app-footer__mark">${renderBrandMark(16)}</div>
        <p>Matura-Arbeit 2026 · Kantonsschule Zofingen</p>
      </footer>
    </div>
  `

  const content = root.querySelector<HTMLElement>('#screen-content')
  if (!content) {
    throw new Error('appShell: #screen-content wurde nicht gefunden')
  }
  return content
}
