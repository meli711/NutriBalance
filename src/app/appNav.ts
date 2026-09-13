/**
 * Persistente Hauptnavigation im Header (rechts von der Wortmarke), auf
 * allen Screens sichtbar. Ersetzt die zuvor pro Seite duplizierten
 * Buttons ("Mein Bedarf"/"Rezepte"/"Eigene Menüs" auf dem Tages-Log,
 * "Rezepte ansehen"/"Eigene Menüs"/"Zurück zum Tages-Log" auf der
 * Bedarfs-Anzeige) — eine Stelle statt vier.
 */
export type NavSection = 'log' | 'verlauf' | 'bedarf' | 'zutaten' | 'recipes' | 'menus' | 'profil'

export interface AppNavOptions {
  container: HTMLElement
  active: NavSection | null
  onNavigate: (section: NavSection) => void
}

// Reihenfolge Instruktion 14: Profil vorne (Einstieg für neue/wiederkehrende
// Nutzer), danach Bedarf → Log → Verlauf (Ablauf "was brauche ich" → "was
// habe ich gegessen" → "wie war der Verlauf"), dann Zutaten/Menüs/Rezepte
// als Nachschlage-/Verwaltungsseiten.
const NAV_ITEMS: { section: NavSection; label: string }[] = [
  { section: 'profil', label: 'Profil' },
  { section: 'bedarf', label: 'Mein Bedarf' },
  { section: 'log', label: 'Log' },
  { section: 'verlauf', label: 'Verlauf' },
  { section: 'zutaten', label: 'Zutaten' },
  { section: 'menus', label: 'Menüs' },
  { section: 'recipes', label: 'Rezepte' },
]

export function renderAppNav(options: AppNavOptions): void {
  const { container, active, onNavigate } = options

  container.innerHTML = NAV_ITEMS.map(
    (item) => `
      <button
        type="button"
        class="app-nav__item${item.section === active ? ' is-active' : ''}"
        data-section="${item.section}"
        aria-current="${item.section === active ? 'page' : 'false'}"
      >${item.label}</button>`,
  ).join('')

  container.querySelectorAll<HTMLButtonElement>('[data-section]').forEach((button) => {
    button.addEventListener('click', () => {
      const section = button.dataset.section as NavSection | undefined
      if (section) onNavigate(section)
    })
  })
}

/** Vor dem ersten Profil (Willkommens-Formular) gibt es noch nichts zu navigieren. */
export function clearAppNav(container: HTMLElement): void {
  container.innerHTML = ''
}
