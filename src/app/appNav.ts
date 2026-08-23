/**
 * Persistente Hauptnavigation im Header (rechts von der Wortmarke), auf
 * allen Screens sichtbar. Ersetzt die zuvor pro Seite duplizierten
 * Buttons ("Mein Bedarf"/"Rezepte"/"Eigene Menüs" auf dem Tages-Log,
 * "Rezepte ansehen"/"Eigene Menüs"/"Zurück zum Tages-Log" auf der
 * Bedarfs-Anzeige) — eine Stelle statt vier.
 */
export type NavSection = 'log' | 'bedarf' | 'recipes' | 'menus' | 'profil'

export interface AppNavOptions {
  container: HTMLElement
  active: NavSection | null
  onNavigate: (section: NavSection) => void
}

const NAV_ITEMS: { section: NavSection; label: string }[] = [
  { section: 'log', label: 'Log' },
  { section: 'bedarf', label: 'Mein Bedarf' },
  { section: 'recipes', label: 'Rezepte' },
  { section: 'menus', label: 'Menüs' },
  { section: 'profil', label: 'Profil' },
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
