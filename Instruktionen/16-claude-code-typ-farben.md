# Instruktion 16: Typ-Farben für Zutat/Menü/Rezept

## Kontext
Aufbauend auf:
- `Instruktionen/DESIGN.md` (Instruktion 7) — bestehende Farbpalette:
  Primär-Grün (`--color-primary`, steht für "Aufnahme"), Akzent-Amber
  (`--color-accent`, steht für "Bedarf"), Muted Plum
  (`--color-support`, sparsam für Warnhinweise/Zusatzakzente). Diese drei
  bleiben **unverändert** in ihrer bestehenden Bedeutung — nicht für die
  Typ-Unterscheidung wiederverwenden
- `src/features/daily-log/dailyLogView.ts` — Log-Zeilen mischen alle drei
  Eintragstypen (`food`/`recipe`/`menu`) in einer Liste (Instruktion 15)
- `src/features/recipes/recipeListView.ts`/`recipeDetailView.ts`,
  `src/features/menu-builder/menuListView.ts`/`menuDetailView.ts`,
  `src/features/ingredients/ingredientsPageView.ts`/`foodDetailView.ts` —
  je eigener Listen-/Detail-Screen pro Typ, aktuell alle mit identischem,
  generischem `<h1>` (erbt `--color-primary` aus dem globalen `h1`-Stil)
- `src/styles/main.css` — `.recipe-list`/`.recipe-detail` sind
  **geteilte** Klassen über alle drei Typen hinweg (kein eigener Screen-
  Wrapper pro Typ)

Ziel: **Zutat, Menü und Rezept sollen auf einen Blick unterscheidbar
sein** — vor allem im Tages-Log, wo alle drei gemischt vorkommen, aber
auch auf den jeweils eigenen Screens. Farbwahl wurde vorab als Mockup
(Claude-Artifact) mit der Nutzerin abgestimmt und bestätigt.

**Bewusst nicht Teil dieser Instruktion:** die Hauptnavigation
(`appNav.ts`) — im Mockup als "evtl."-Option gezeigt, auf Wunsch der
Nutzerin aber zurückgestellt.

---

## Farbentscheidung

Drei neue, eigenständige Typ-Farben — getrennt von Primär/Akzent/Support,
die ihre bestehende Bedeutung behalten:

| Typ      | Name           | Hex       |
| -------- | -------------- | --------- |
| `food`   | Zutat — Oliv   | `#5c6827` |
| `menu`   | Menü — Taubenblau | `#3d5a8a` |
| `recipe` | Rezept — Indigo | `#6a4f8a` |

Grundregel: **nie als Fläche**, immer als schmaler Akzent (Rand, Punkt,
Überschriften-Farbe) — passend zur reduzierten, "gedeckten" Formsprache
aus DESIGN.md, nicht als zusätzliche bunte Deko-Palette.

---

## Aufgaben

### 1. Tokens
`src/styles/main.css`, `:root`:
- Drei neue Custom Properties `--color-type-food: #5c6827`,
  `--color-type-menu: #3d5a8a`, `--color-type-recipe: #6a4f8a`, mit
  Kommentar analog zu den bestehenden Farb-Tokens (Zweck + Abgrenzung zu
  Primär/Akzent/Support)

### 2. Tages-Log
`src/features/daily-log/dailyLogView.ts`:
- Jede Zeile bekommt zusätzlich zur bestehenden Klasse
  `menu-builder__ingredient-row` die neue Klasse `daily-log__entry-row`
  sowie `data-entry-type="${entry.type}"` (Wert `food`/`recipe`/`menu`,
  direkt aus `LogEntry['type']`)
- Vor dem Label ein kleiner Punkt: `<span class="daily-log__type-dot"
  aria-hidden="true"></span>` (rein dekorativ, der Eintragstyp ist über
  Label + Kontext ohnehin erkennbar — daher `aria-hidden`, nicht als
  einzige Information codiert)
- Gilt für **alle** Zeilen, auch bei `missing: true` (referenziertes
  Rezept/Menü/Zutat existiert nicht mehr) — der Typ des gelöschten
  Eintrags bleibt weiterhin sichtbar, nur die Zahlenfelder fehlen dort
  wie bisher

`src/styles/main.css`:
- `.daily-log__entry-row { border-left-width: 4px; }` — überschreibt nur
  die Breite des bereits bestehenden `border` (1px solid
  `--color-border`) der geteilten `.menu-builder__ingredient-row`-Basis
- Farbe **pro Zeile** über Attribut-Selektor, nicht über drei zusätzliche
  Klassen (weniger String-Verkettung in `dailyLogView.ts`):
  `.daily-log__entry-row[data-entry-type='food'] { border-left-color:
  var(--color-type-food); }` (analog für `menu`/`recipe`)
- `.daily-log__type-dot { width: 8px; height: 8px; border-radius: 50%;
  flex-shrink: 0; }`, Hintergrundfarbe ebenfalls über
  `[data-entry-type='...'] .daily-log__type-dot { background-color:
  var(--color-type-...); }`
- **Nicht** anfassen: `.menu-builder__ingredient-row` selbst (wird auch
  vom Menü-Builder für reine Zutat-Zeilen beim Menü-Zusammenstellen
  verwendet, dort ist keine Typ-Unterscheidung nötig — alle Zeilen dort
  sind Zutaten)

### 3. Listen-/Detail-Screens
Drei neue, einfache Utility-Klassen (Farbe auf `<h1>`, kein neuer Screen-
Wrapper nötig, da `.recipe-list`/`.recipe-detail` geteilt bleiben):
```css
.type-heading-food { color: var(--color-type-food); }
.type-heading-menu { color: var(--color-type-menu); }
.type-heading-recipe { color: var(--color-type-recipe); }
```
Anwenden auf jedes `<h1>` der jeweiligen Screens (ersetzt die geerbte
`--color-primary`-Farbe aus dem globalen `h1`-Stil):
- **Zutat** (`type-heading-food`): `ingredientsPageView.ts` (`<h1>Zutaten</h1>`,
  deckt beide Tabs "Datenbank"/"Eigene Zutaten" ab — beides Zutaten),
  `foodDetailView.ts` (beide Stellen: normale Ansicht **und**
  Bearbeiten-Ansicht `renderEdit`)
- **Menü** (`type-heading-menu`): `menuListView.ts` (alle drei Stellen:
  Fehler-, Erfolgs- und initialer Lade-Zustand — Heading-Text ist überall
  identisch `"Eigene Menüs"`), `menuDetailView.ts`
- **Rezept** (`type-heading-recipe`): `recipeListView.ts` (beide Stellen:
  Lade- und Erfolgs-Zustand), `recipeDetailView.ts`
- Reine Fehler-/Lade-Zustände ohne `<h1>` (z.B. "Rezept nicht gefunden")
  bleiben unverändert, dort gibt es nichts einzufärben

### 4. Kontrast
Alle drei neuen Farben wurden gegen `--color-bg` (`#f5f7f2`) geprüft:
Taubenblau/Indigo ≈ 6.4:1 (klar über WCAG AA für Fliesstext), Oliv ≈
4.4:1 (über AA für grosse Texte/UI-Elemente wie `<h1>`/Punkte, knapp
unter 4.5:1 für Fliesstext — hier nicht relevant, da Oliv nur für
Überschriften/Rand/Punkt verwendet wird, nie für Fliesstext)

---

## Was NICHT Teil dieses Auftrags ist
- **Hauptnavigation** (`appNav.ts`) — im Mockup gezeigt, aber auf Wunsch
  zurückgestellt; kann später als eigene, kleine Instruktion nachgezogen
  werden
- Keine Änderung an Primär-/Akzent-/Support-Farbe oder deren bestehender
  Bedeutung (Aufnahme/Bedarf/Warnhinweise)
- Keine Typ-Farbe als Flächenfarbe (Button-Hintergrund, Card-Fill o.Ä.) —
  ausschliesslich schmaler Akzent (Rand/Punkt/Überschrift)
- Keine Typ-Unterscheidung im Menü-Builder (`menuBuilderView.ts`) — dort
  sind alle Zeilen immer Zutaten, keine Mischung, daher keine
  Farb-Codierung nötig
- Keine Legende/Erklärung der Farben in der App selbst (z.B. "Oliv =
  Zutat") — die Farbe ist ein zusätzliches, unterstützendes
  Unterscheidungsmerkmal neben Label/Icon, nicht die einzige
  Informationsquelle (Accessibility: nichts hängt ausschliesslich an der
  Farbe)

## Nach Abschluss
Bitte zeigen:
- Tages-Log mit mindestens einem Eintrag pro Typ (Zutat/Rezept/Menü) —
  linker Rand + Punkt in den drei unterschiedlichen Farben sichtbar
- Zutaten-, Menüs- und Rezepte-Screen (Liste + Detail) je mit der
  passenden `<h1>`-Farbe
- Kurz bestätigen, dass die Farben **nicht** mit Primär-Grün/Akzent-Amber
  aus den Charts/Buttons verwechselbar sind (nebeneinander sichtbar,
  z.B. Log-Screen mit Nährwert-Chart darunter)
