# Instruktion 21: Kategorie auch für eigene Menüs + Icons im Tages-Log

## Kontext

Aufbauend auf:

- `src/utils/mealCategoryIcon.ts` (Instruktion 20, um "Vorspeise" ergänzt)
  — `MealCategory`, `MEAL_CATEGORIES`, `isMealCategory`,
  `renderMealCategoryIcon`. Bisher ausschliesslich für `Recipe.category`
  genutzt.
- `src/features/menu-builder/models/menu.ts` — `Menu` ist bewusst
  strukturell identisch zu `Recipe` (nur ohne `servings`/`instructions`,
  siehe Kommentar dort) — hat aber bisher **kein** `category`-Feld.
- `src/features/menu-builder/menuBuilderView.ts` — Formular zum Erstellen
  eines neuen Menüs (`renderMenuBuilderView`, einzige Stelle, an der ein
  `Menu` gebaut wird — es gibt keinen separaten Bearbeiten-Dialog für
  Name/Beschreibung/Kategorie eines bestehenden Menüs). Felder aktuell:
  Name (`#menu-name`), Beschreibung (`#menu-description`).
- `src/features/ingredients/customFoodForm.ts` — Vorlage für ein
  optionales `<select>`-Feld mit "– keine Angabe –"-Option (Nova-Gruppe,
  Instruktion 17): `.field`-Wrapper, Label mit "(optional)"-Zusatz.
- `src/features/menu-builder/menuListView.ts` — `renderItems` zeigt pro
  Zeile bisher nur Name + Erstellungsdatum (`.recipe-list__servings`),
  kein Icon.
- `src/features/recipes/recipeListView.ts` — Vorlage für die
  Icon-Anzeige: `.recipe-list__label` umschliesst optionales
  `.recipe-list__icon` (`renderMealCategoryIcon`) + `.recipe-list__name`.
- `src/features/daily-log/dailyLogView.ts` — `resolveEntry(entry)` löst
  jeden Log-Eintrag bereits auf ein konkretes `FoodItem`/`Recipe`/`Menu`
  auf (`ResolvedEntry` mit `label`/`missing`/`nova`); die Zeilen-Vorlage
  (`entryRows`) rendert pro Eintrag `.daily-log__type-dot` (Typ-Farbe,
  Instruktion 16) + Label + Nova-Tag (Instruktion 17). Bisher **keine**
  Kategorie-Anzeige, obwohl `resolveEntry` für `recipe`/`menu` bereits das
  volle `Recipe`/`Menu`-Objekt lädt.

Ziel: Menüs bekommen dieselbe, optionale Kategorie wie Rezepte — mit
denselben Icons (kein separates Icon-Set). Auswahl über ein `<select>`-
Dropdown im Menü-Erstellen-Formular (nicht per `window.prompt`, da hier —
anders als beim seltenen "Als Rezept exportieren" — ein normales
Formularfeld zur Verfügung steht). Das gewählte Icon erscheint danach in
der Menü-Liste, analog zur Rezeptliste, **und zusätzlich pro Zeile im
Tages-Log** — sowohl für Rezept- als auch für Menü-Einträge (`food`-
Einträge haben keine Kategorie, siehe Punkt 4).

---

## Aufgaben

### 1. Datenmodell

`src/features/menu-builder/models/menu.ts`:

- Neues optionales Feld `category?: MealCategory` auf `Menu` (Import aus
  `utils/mealCategoryIcon.ts`), Kommentar analog zu `Recipe.category`
  (Instruktion 20): dient auch beim manuellen Bearbeiten der Menü-Daten
  im Daten-Backup als lesbares Label, fehlt/unbekannt → kein Icon.

### 2. Auswahl im Erstellen-Formular

`src/features/menu-builder/menuBuilderView.ts`:

- Neues `<div class="field">` mit `<select id="menu-category">` direkt
  nach dem Beschreibungsfeld (vor dem Zutaten-Picker), Aufbau wie das
  Nova-Gruppe-Feld in `customFoodForm.ts`: erste Option `""` = "– keine
  Angabe –", danach eine `<option>` pro Eintrag aus `MEAL_CATEGORIES`
  (Wert = Label, keine Übersetzung nötig, ist ja schon Deutsch).
  Label: "Kategorie (optional)".
- Beim Speichern (`data-action="save"`-Handler): Select-Wert auslesen,
  bei nicht-leerem, über `isMealCategory` bestätigtem Wert `category` auf
  das neue `Menu`-Objekt setzen — sonst das Feld ganz weglassen (kein
  `category: undefined`, gleiches Muster wie `menuToRecipe` in
  `menuExportService.ts`, Instruktion 20).

### 3. Anzeige in der Menü-Liste

`src/features/menu-builder/menuListView.ts`:

- `renderItems`: Button-Inhalt auf dieselbe Struktur wie
  `recipeListView.ts` umstellen — `.recipe-list__label` umschliesst
  optionales `.recipe-list__icon` (`renderMealCategoryIcon(menu.category)`,
  nur falls `menu.category && isMealCategory(menu.category)`) +
  `.recipe-list__name`; das bestehende `.recipe-list__servings`-Datum
  bleibt als zweites Element im Button unverändert daneben stehen.

### 4. Icons im Tages-Log

`src/features/daily-log/dailyLogView.ts`:

- `ResolvedEntry` um `category?: MealCategory` erweitern (Kommentar:
  `undefined` bei `food`-Einträgen — keine Kategorie vorgesehen — oder
  wenn das referenzierte Rezept/Menü keine gesetzt hat).
- `resolveEntry`: im `recipe`-Zweig `category: recipe.category`
  übernehmen, im `menu`-Zweig `category: menu.category` — beide Objekte
  sind an dieser Stelle bereits geladen (für die Nova-Berechnung), kein
  zusätzlicher Ladevorgang nötig. Im `food`-Zweig bleibt `category` weg
  (Zutaten haben keine Kategorie).
- In `entryRows` direkt nach `.daily-log__type-dot` und vor
  `.daily-log__entry-label` ein optionales Icon einfügen, wiederverwendet
  über dieselbe `.recipe-list__icon`-Klasse (kein neuer Style nötig, der
  umgebende `.menu-builder__ingredient-row`/`.daily-log__entry-row` ist
  bereits eine Flex-Row): nur rendern, wenn `!missing && category &&
isMealCategory(category)` — bei einem entfernten Rezept/Menü (`missing:
true`) gibt es kein Icon, analog zum bestehenden Nova-Tag.

---

## Was NICHT Teil dieses Auftrags ist

- **Kein Bearbeiten-Dialog** für ein bereits gespeichertes Menü (Name/
  Beschreibung/Kategorie nachträglich ändern) — es gibt aktuell generell
  keinen solchen Dialog, das bleibt unangetastet; Kategorie lässt sich nur
  beim Erstellen setzen.
- **Keine Anzeige der Kategorie in `menuDetailView.ts`/`recipeDetailView.ts`**
  — die Kategorie erscheint nur in den Listen (Rezepte/Menüs) und im
  Tages-Log (Punkt 4), nicht in den Detailansichten.
- **Keine Kategorie/kein Icon für `food`-Log-Einträge** — nur Rezepte und
  Menüs haben eine Kategorie; einzeln geloggte Zutaten bleiben ohne Icon.
- **Kein eigenes Kategorie-Tag in der Tagessumme** (`Nährwerte
(Tagessumme)`, analog zum Nova-Badge dort) — die Icons erscheinen nur
  pro einzelner Log-Zeile, nicht zusätzlich aggregiert für den ganzen Tag.
- **Keine neuen Icons** — Menüs nutzen exakt dieselben fünf Kategorien/
  Icons wie Rezepte (`MEAL_CATEGORIES`, Instruktion 20).
- **Keine Änderung an `menuToRecipe`/"Als Rezept exportieren"** — ob ein
  Menü selbst eine Kategorie hat, wird beim Export zu einem Rezept
  bewusst nicht automatisch übernommen; der bestehende, separate
  Kategorie-Prompt dort (Instruktion 20) bleibt unverändert.

## Nach Abschluss

Bitte zeigen:

- Ein neues Menü erstellen, im neuen Dropdown "Snack" wählen und
  speichern → in "Eigene Menüs" erscheint das Snack-Icon (Blatt) vor dem
  Menü-Namen.
- Ein Menü ohne Kategorie erstellen (Dropdown auf "– keine Angabe –"
  lassen) → erscheint in der Liste ohne Icon, wie bisher.
- Das kategorisierte Menü sowie ein Rezept mit Kategorie im Tages-Log
  erfassen → beide Zeilen zeigen das jeweilige Icon zwischen Typ-Punkt und
  Name; eine direkt geloggte Zutat (`food`) zeigt kein Icon.
- Ein geloggtes Rezept/Menü anschliessend löschen (aus "Eigene Rezepte"/
  "Eigene Menüs") und den betroffenen Log-Tag erneut öffnen → die Zeile
  zeigt "Entferntes Rezept/Menü" ohne Icon, stürzt nicht ab.
- `npm test`, `npm run typecheck`, `npm run lint` und `npm run build`
  grün.
