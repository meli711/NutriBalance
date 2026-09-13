import { renderFoodDatabaseList } from './foodDatabaseListView.ts'
import { renderOwnFoodsPanel } from './ownFoodsPanel.ts'

export interface IngredientsPageOptions {
  container: HTMLElement
  onSelectFood: (foodId: string, tab: IngredientsTab) => void
  onBack: () => void
  /** Welcher Tab beim Öffnen aktiv ist — z.B. "own", wenn man von der Detailansicht einer eigenen Zutat zurückkommt. */
  initialTab?: IngredientsTab
}

export type IngredientsTab = 'database' | 'own'

const TAB_LABELS: Record<IngredientsTab, string> = {
  database: 'Zutaten',
  own: 'Eigene Zutaten',
}

/**
 * Reiter "Zutaten" in der Hauptnavigation (Instruktion 14) — Umschalter
 * zwischen der gesamten Datenbank (generisch + Build-Zeit-Markenprodukte,
 * read-only, `foodDatabaseListView.ts`) und den eigenen, lokal erfassten
 * Zutaten (`ownFoodsPanel.ts`, umgezogen von der Profilseite aus
 * Instruktion 13). Gleiches Umschalter-Muster wie beim Tages-Log-Eintrag
 * ("Rezept/Menü/Zutat", siehe `addLogEntryView.ts`).
 */
export function renderIngredientsPage(options: IngredientsPageOptions): void {
  const { container, onSelectFood, onBack, initialTab = 'database' } = options

  container.innerHTML = `
    <section class="recipe-list">
      <h1>Zutaten</h1>

      <div class="nutrient-chart__toggle" role="group" aria-label="Ansicht wählen">
        ${(['database', 'own'] as IngredientsTab[])
          .map(
            (tab) => `
              <button
                type="button"
                class="nutrient-chart__toggle-btn${tab === initialTab ? ' is-active' : ''}"
                data-tab="${tab}"
                aria-pressed="${tab === initialTab}"
              >${TAB_LABELS[tab]}</button>`,
          )
          .join('')}
      </div>

      <div data-tab-content></div>

      <button type="button" class="button-secondary" data-action="back">Zurück</button>
    </section>
  `

  const tabContent = container.querySelector<HTMLDivElement>('[data-tab-content]')!
  const tabButtons = container.querySelectorAll<HTMLButtonElement>('[data-tab]')

  function activateTab(tab: IngredientsTab): void {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tab
      button.classList.toggle('is-active', isActive)
      button.setAttribute('aria-pressed', String(isActive))
    })
    if (tab === 'database') {
      renderFoodDatabaseList({ container: tabContent, onSelectFood: (foodId) => onSelectFood(foodId, tab) })
    } else {
      renderOwnFoodsPanel({ container: tabContent, onSelectFood: (foodId) => onSelectFood(foodId, tab) })
    }
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab as IngredientsTab | undefined
      if (tab) activateTab(tab)
    })
  })

  container.querySelector('[data-action="back"]')?.addEventListener('click', onBack)

  activateTab(initialTab)
}
