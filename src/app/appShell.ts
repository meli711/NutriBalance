import { renderBrandMark } from './brandMark.ts'

/**
 * Persistenter Rahmen (Header/Nav/Footer) für alle Screens, siehe DESIGN.md.
 * Wird einmalig beim App-Start gerendert. Die bestehenden Screen-Render-
 * Funktionen (Instruktion 3-6) bekommen den `content`-Slot als `container`
 * statt `#app` direkt — an ihrer eigenen Logik ändert sich dadurch nichts,
 * sie verlieren nur ihr eigenes `<main>`-Tag (jetzt hier zentral, damit pro
 * Seite nur ein `<main>`-Landmark existiert). Der `nav`-Slot wird bei jedem
 * Screen-Wechsel neu befüllt (siehe `appNav.ts`), damit der aktive Eintrag
 * korrekt markiert ist.
 */
export interface AppShellSlots {
  content: HTMLElement
  nav: HTMLElement
}

export function renderAppShell(root: HTMLElement): AppShellSlots {
  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div class="app-header__inner">
          <div class="app-header__brand">
            ${renderBrandMark(36)}
            <p class="app-header__wordmark">Meliane's <strong>NutriBalance</strong></p>
          </div>
          <nav class="app-nav" data-app-nav aria-label="Hauptnavigation"></nav>
        </div>
      </header>
      <main id="screen-content" class="app-content"></main>
      <footer class="app-footer">
        <div class="app-footer__mark">${renderBrandMark(16)}</div>
        <p>Matura-Arbeit 2026 · Kantonsschule Zofingen · Meliane</p>
      </footer>
    </div>
  `

  const content = root.querySelector<HTMLElement>('#screen-content')
  const nav = root.querySelector<HTMLElement>('[data-app-nav]')
  if (!content || !nav) {
    throw new Error('appShell: #screen-content oder [data-app-nav] wurde nicht gefunden')
  }
  return { content, nav }
}
