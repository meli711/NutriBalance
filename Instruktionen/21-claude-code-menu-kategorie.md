# Instruktion 21: Kategorie auch für eigene Menüs

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

Ziel: Menüs bekommen dieselbe, optionale Kategorie wie Rezepte — mit
denselben Icons (kein separates Icon-Set). Auswahl über ein `<select>`-
Dropdown im Menü-Erstellen-Formular (nicht per `window.prompt`, da hier —
anders als beim seltenen "Als Rezept exportieren" — ein normales
Formularfeld zur Verfügung steht). Das gewählte Icon erscheint danach in
der Menü-Liste, analog zur Rezeptliste.

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

---

## Was NICHT Teil dieses Auftrags ist

- **Kein Bearbeiten-Dialog** für ein bereits gespeichertes Menü (Name/
  Beschreibung/Kategorie nachträglich ändern) — es gibt aktuell generell
  keinen solchen Dialog, das bleibt unangetastet; Kategorie lässt sich nur
  beim Erstellen setzen.
- **Keine Anzeige der Kategorie in `menuDetailView.ts`** — analog zu
  Rezepten, wo die Kategorie ebenfalls nur in der Liste erscheint, nicht
  in der Detailansicht.
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
- `npm test`, `npm run typecheck`, `npm run lint` und `npm run build`
  grün.
