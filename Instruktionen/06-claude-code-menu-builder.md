# Instruktion 6: Menü-Builder — eigene Menüs aus Zutaten erstellen (IndexedDB)

## Kontext
Aufbauend auf:
- `src/data/foodDatabaseService.ts` — Zutaten-Suche (`searchFoodsByName`)
- `src/features/recipes/nutritionCalculator.ts` — Berechnungslogik für
  Nährwerte aus einer Zutatenliste
- `src/features/charts/nutrientComparisonChart.ts` — Bedarf-vs-Aufnahme-Chart
  (bereits generisch für beliebige `NutrientValues` gebaut, siehe Instruktion 5)
- `src/data/indexedDbService.ts` — bisher nur Grundgerüst (aus Instruktion 1),
  wird jetzt erstmals mit echtem Object Store befüllt

Neues Feature: Nutzer:innen können ein eigenes "Menü" aus einzelnen Zutaten
zusammenstellen (Zutat suchen, Menge in Gramm angeben, mehrere Zutaten
kombinieren), sehen live die berechnete Nährstoffaufnahme inkl. %-Bedarf und
Chart, und können das Menü in IndexedDB speichern  (mit Name & Beschreibung), um es später wieder
aufzurufen. 

**FTP-Anbindung ist explizit nicht Teil dieser Instruktion** — Menüs werden
ausschliesslich lokal in IndexedDB gespeichert.

---

## Aufgaben

### 1. Datenmodell
`src/features/menu-builder/models/menu.ts`:
```ts
interface Menu {
  id: string;              // z.B. via crypto.randomUUID()
  name: string;
  description:string;
  createdAt: string;        // ISO-Datum
  ingredients: RecipeIngredient[];   // gleiche Struktur wie bei Recipe
                                       // ({ foodId, amountGrams })
}
```
Bewusst strukturell identisch zu `Recipe` (nur ohne `servings`/`instructions`,
da hier keine Portionenlogik nötig ist — ein Menü wird als Ganzes betrachtet).
Dadurch kann `nutritionCalculator` unverändert wiederverwendet werden
(Funktion ggf. leicht verallgemeinern, falls sie aktuell zu eng an den
`Recipe`-Typ gebunden ist: sie sollte eigentlich nur eine
`RecipeIngredient[]` brauchen, nicht das ganze Recipe-Objekt).

### 2. IndexedDB Object Store einrichten
In `src/data/indexedDbService.ts`:
- Object Store `menus` anlegen (`id` als Key)
- Funktionen: `saveMenu(menu: Menu): Promise<void>`,
  `getAllMenus(): Promise<Menu[]>`, `getMenuById(id: string): Promise<Menu |
  undefined>`, `deleteMenu(id: string): Promise<void>`
- Bestehenden `idb`-Wrapper (aus Instruktion 1) dafür nutzen, nicht direkt
  die rohe IndexedDB-API verwenden

### 3. Neue Screens
Ja, neue Screens — bitte ins bestehende einfache State-basierte Navigations-
system einhängen (aus Instruktion 3, kein Router nötig):

```
src/features/menu-builder/
  menuBuilderView.ts     # Screen: neues Menü zusammenstellen
  menuListView.ts        # Screen: gespeicherte Menüs auflisten
  menuDetailView.ts       # Screen: gespeichertes Menü ansehen (inkl. Chart)
```

**a) `menuBuilderView.ts`** (Erstellungs-Screen)
- Namensfeld fürs Menü
- Beschreibungsfeld
- Zutaten-Suche: Texteingabe → Live-Vorschläge über `searchFoodsByName`
  (einfaches Dropdown/Liste reicht, kein Autocomplete-Overengineering)
- Ausgewählte Zutat + Mengeneingabe (Gramm) → "Hinzufügen"-Button → erscheint
  in einer laufenden Liste unterhalb
- Laufende Liste: hinzugefügte Zutaten mit Menge, einzeln entfernbar
- **Live-Vorschau**: bei jeder Änderung der Zutatenliste berechnete
  Nährwerte (via `nutritionCalculator`) + %-Bedarf (Profil aus
  `localStorageService`) + das bestehende Chart aktualisieren — kein Klick
  auf "Berechnen" nötig, direktes Feedback
- "Speichern"-Button: legt `Menu`-Objekt an, ruft `saveMenu()` auf, wechselt
  danach zur Menü-Liste oder Detailansicht

**b) `menuListView.ts`**
- Liste aller gespeicherten Menüs (Name, Erstellungsdatum)
- Klick → Detailansicht
- Löschen-Option pro Eintrag (`deleteMenu`, mit kurzer Bestätigung vor dem
  Löschen)
- Button "Neues Menü erstellen" → `menuBuilderView`

**c) `menuDetailView.ts`**
- Analog zur bestehenden `recipeDetailView`: Zutatenliste, Nährwerttabelle
  inkl. %-Bedarf-Spalte, Chart
- Kann intern denselben Anzeige-Code wie `recipeDetailView` wiederverwenden,
  falls sich das sauber extrahieren lässt (z.B. eine gemeinsame
  `nutritionSummaryView.ts`-Komponente, die sowohl von Rezepten als auch
  Menüs genutzt wird) — bitte NICHT den Code einfach duplizieren

### 4. Navigation erweitern
- Einstiegspunkt (`src/app/`) um die neuen Screens ergänzen
- Sinnvoller Einstieg z.B. über einen neuen Menüpunkt/Button in der
  bestehenden Navigation: "Eigene Menüs"

### 5. Edge Cases
- Menü ohne Zutaten kann nicht gespeichert werden (Validierung, Hinweis an
  Nutzer:in)
- Menü ohne Namen: sinnvollen Default-Namen vorschlagen (z.B. Datum), aber
  Speichern trotzdem erlauben
- Gleiche Zutat zweimal hinzugefügt: entweder zusammenführen (Mengen
  addieren) oder als zwei separate Einträge behandeln — bitte einfachere
  Variante wählen (zwei separate Einträge, kein Merging), das ist für den
  Scope hier ausreichend

### 6. Tests
- Unit-Test: Speichern + Laden eines Menüs aus IndexedDB (Round-Trip-Test)
- Unit-Test: `nutritionCalculator` liefert für eine manuell zusammengestellte
  Zutatenliste die erwarteten Werte (falls noch nicht durch bestehende Tests
  aus Instruktion 4 abgedeckt)

---

## Was NICHT Teil dieses Auftrags ist
- Keine FTP-/externe Datenquelle
- Kein Kombinieren mehrerer vordefinierter Rezepte zu einem Menü (das wäre
  der separate "Menu Creator"-Ansatz, aktuell nicht verfolgt)
- Kein Bearbeiten eines bereits gespeicherten Menüs (nur Anzeigen + Löschen) —
  falls einfach umsetzbar, gerne, aber kein Muss für diese Instruktion
- Keine Mengeneinheiten ausser Gramm (konsistent mit Instruktion 4)

## Nach Abschluss
Bitte zeigen:
- Kurzer Ablauf: Zutat suchen → hinzufügen → Live-Vorschau → speichern →
  in der Liste wiederfinden
- Bestätigen, ob `nutritionSummaryView` (oder Äquivalent) tatsächlich von
  Rezepten und Menüs gemeinsam genutzt wird, oder ob es zu Code-Duplikation
  kam und warum
