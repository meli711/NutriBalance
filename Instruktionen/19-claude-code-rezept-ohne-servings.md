# Instruktion 19: `servings` aus dem Rezept-Modell entfernen

## Kontext

Aufbauend auf:

- `src/features/recipes/models/recipe.ts` — `Recipe.servings: number`
  ("Anzahl Portionen, die das Rezept ergibt").
- `public/data/recipes.json` (8 Einträge) — 7× `servings: 1`, 1×
  `servings: 2` ("Gemüsepfanne mit Teigwaren", `gemuesepfanne-teigwaren`,
  Zutatenmengen für die **ganze** 2-Portionen-Zubereitung).
- `src/features/recipes/nutritionCalculator.ts` — `calculateRecipeNutrition`
  (Summe über `recipe.ingredients`, unskaliert) und `calculatePerServing`
  (dividiert das Ergebnis zusätzlich durch `recipe.servings`).
- `src/features/recipes/recipeDetailView.ts`/`recipeListView.ts` — zeigen
  `${recipe.servings} Portion(en)`; `recipeDetailView.ts` nutzt
  `calculatePerServing` für die Nährwert-Zusammenfassung ("Nährwerte pro
  Portion").
- `src/features/daily-log/models/logEntry.ts` — `RecipeLogEntry.servings:
number` ("Anzahl gegessener Portionen, z.B. 0.5") **zusätzlich** zu
  `factor` (`LogEntryBase`, Instruktion 15, "wie oft dieser Eintrag an
  diesem Tag vorkommt") — bei `recipe`-Einträgen aktuell zwei unabhängige,
  multiplikative Mengen-Dimensionen; bei `food`/`menu` nur `factor`.
- `src/features/daily-log/dailyNutritionService.ts` —
  `calculateSingleOccurrence`: bei `recipe` `calculatePerServing(...) *
entry.servings`, danach in `calculateEntryNutrition` zusätzlich `*
entry.factor` — bei `food`/`menu` direkt nur `* entry.factor`.
- `src/features/daily-log/dailyLogView.ts` — pro Zeile **genau ein**
  Zahlenfeld: bei `recipe` das Portionen-Feld (`data-servings-input-id`),
  sonst das Faktor-Feld (`data-factor-input-id`); `addLogEntryView.ts`
  legt neue Rezept-Einträge mit `servings: 1, factor: 1` an.
- `src/features/backup/backupService.ts` — `isValidLogEntry` verlangt bei
  `type: 'recipe'` `typeof v.servings === 'number'`.
- `src/data/indexedDbService.ts` — `normalizeLogEntry(entry)` ergänzt beim
  **Lesen** (nicht dauerhaft im Store) ein fehlendes `factor` auf `1`
  (Instruktion 15) — Präzedenzfall für rückwärtskompatibles Behandeln
  alter, bereits gespeicherter Log-Einträge ohne Schema-Migration.
- `src/features/menu-builder/menuDetailView.ts` — `promptForServings()`
  (`window.prompt`) + `handleExportAsRecipe`: fragt vor jedem "Als Rezept
  exportieren" nach der Portionenzahl, übergibt sie an `menuToRecipe`.
- `src/features/menu-builder/menuExportService.ts` — `menuToRecipe(menu,
servings, existingIds)` setzt `servings` auf das erzeugte `Recipe`;
  `isValidRecipe` verlangt `typeof v.servings === 'number' && v.servings >
0`.

**Entscheid (mit der Nutzerin abgestimmt):** Ein Rezept in `recipes.json`
beschreibt künftig **immer genau eine Portion** — keine
Batch-Zutatenmengen mit separatem Divisor mehr. Ein Rezept-Log-Eintrag
nutzt danach wie ein Menü-Eintrag ausschliesslich `factor` ("wie oft
gegessen") als einzige Mengen-Dimension; `RecipeLogEntry.servings` entfällt
ersatzlos.

**Wichtig (Datensicherheit bei bestehenden Log-Einträgen):** Ein
bestehender Rezept-Log-Eintrag kann `servings` ≠ 1 haben (z.B. `servings:
0.5, factor: 2` = "an diesem Tag zweimal eine halbe Portion", macht in
Summe `1`). Würde `servings` beim Entfernen des Feldes einfach ignoriert,
läse die App diesen Eintrag künftig als `factor: 2` = "zweimal die ganze
Portion" — die **historische** Tagessumme dieses bereits vergangenen Tages
würde sich rückwirkend und unbemerkt ändern (betrifft auch den
Wochen-/Monats-Verlauf, Instruktion 11, der dieselben Einträge nutzt). Das
muss verhindert werden: das alte `servings` wird beim Lesen multiplikativ
in `factor` gefaltet (`factor_neu = factor_alt * servings_alt`), nicht
verworfen (siehe Punkt 3).

---

## Aufgaben

### 1. Datenmodell

`src/features/recipes/models/recipe.ts`:

- Feld `servings` von `Recipe` entfernen. Kommentar ergänzen: ein Rezept
  entspricht immer genau einer Portion; wer eine grössere Zubereitung
  abbilden will, trägt die volle Zutatenmenge ein und loggt es ggf. mit
  `factor` mehrfach (analog zu Menüs).

### 2. `recipes.json` migrieren

`public/data/recipes.json`:

- Bei allen 8 Einträgen das Feld `servings` entfernen.
- **Nur bei `gemuesepfanne-teigwaren`** (bisher `servings: 2`): alle
  `amountGrams` **halbieren** (150→75, 100→50, 50→25, 15→7.5, 200→100),
  damit die Nährwerte pro Portion identisch zu heute bleiben, statt sich
  durch den Wegfall der Division zu verdoppeln. Bei allen anderen 7
  Einträgen (bereits `servings: 1`) ändert sich an den Mengen nichts.
- `scripts/convert-food-db.ts` ist von `recipes.json` nicht betroffen
  (das Skript erzeugt `food-database.json`, nicht `recipes.json`) — keine
  Änderung nötig.

### 3. Nährwert-Berechnung

`src/features/recipes/nutritionCalculator.ts`:

- `calculatePerServing` entfernen (obsolet — `calculateRecipeNutrition`
  entspricht jetzt bereits "pro Portion", da ein Rezept immer eine Portion
  ist).
- `calculateRecipeNutrition` bleibt unverändert bestehen.

`src/features/recipes/recipeDetailView.ts`:

- Import/Aufruf von `calculatePerServing` durch `calculateRecipeNutrition`
  ersetzen.
- `<p class="recipe-detail__meta">${recipe.servings} Portion…</p>`-Zeile
  entfernen (ein Rezept ist immer eine Portion, die Angabe wäre
  redundant/immer "1 Portion").
- Überschrift der Nährwert-Zusammenfassung von "Nährwerte pro Portion" zu
  schlicht "Nährwerte" (analog zu `menuDetailView.ts`, das ebenfalls kein
  "pro X" mehr braucht).

`src/features/recipes/recipeListView.ts`:

- `<span class="recipe-list__servings">${recipe.servings} Portion…</span>`
  in `renderItems` ersatzlos entfernen (keine Portionenangabe mehr in der
  Liste; die Zeile zeigt danach nur noch Icon + Name, wie bei Menüs schon
  ohne zusätzliche rechte Spalte).

### 4. Log-Eintrag: `servings` durch alleiniges `factor` ersetzen

`src/features/daily-log/models/logEntry.ts`:

- `servings` von `RecipeLogEntry` entfernen — `RecipeLogEntry` besteht
  danach nur noch aus `type: 'recipe'`, `recipeId`, plus `factor` aus
  `LogEntryBase` (strukturell identisch zu `MenuLogEntry`, nur mit
  `recipeId` statt `menuId`).

`src/data/indexedDbService.ts`:

- `normalizeLogEntry` erweitern: **zusätzlich** zur bestehenden
  `factor`-Defaultierung ein evtl. noch vorhandenes altes `servings`-Feld
  bei `type === 'recipe'`-Einträgen erkennen (defensiver Cast wie beim
  bestehenden `factor`-Zugriff, da der Typ das Feld nicht mehr kennt) und
  multiplikativ in `factor` falten: `factor = (factor ?? 1) * servings`,
  `servings` aus dem zurückgegebenen Objekt entfernen. Bleibt wie bisher
  eine **reine Lese-Normalisierung** (kein Zurückschreiben in den Store);
  eine spätere Bearbeitung des Eintrags (z.B. Faktor ändern im Tages-Log)
  persistiert die gefaltete, `servings`-freie Form ganz automatisch beim
  nächsten `updateLogEntry`.
- **Kein Bump von `DB_VERSION`** — Begründung wie bei `factor`
  (Instruktion 15) kurz kommentieren: IndexedDB validiert Object-Store-
  Inhalte nicht gegen ein Schema, das Entfernen eines Feldes braucht keine
  `upgrade()`-Änderung.

`src/features/daily-log/dailyNutritionService.ts`:

- `calculateSingleOccurrence`, Fall `recipe`: `calculatePerServing(recipe,
foodsById) * entry.servings` ersetzen durch schlicht
  `calculateRecipeNutrition(recipe, foodsById)` — die Multiplikation mit
  `entry.factor` passiert wie bei `food`/`menu` bereits einheitlich in
  `calculateEntryNutrition`.
- Nicht mehr benötigten Import von `calculatePerServing` entfernen.

`src/features/daily-log/dailyLogView.ts`:

- Die Fallunterscheidung "bei `recipe` Portionen-Feld, sonst Faktor-Feld"
  entfernen: **alle** drei Typen zeigen künftig einheitlich nur das
  Faktor-Feld (`data-factor-input-id`), wie aktuell schon bei `menu`.
  `servingsInput`-Variable, das zugehörige Markup-Fragment sowie den
  gesamten `[data-servings-input-id]`-Event-Listener-Block ersatzlos
  entfernen.

`src/features/daily-log/addLogEntryView.ts`:

- Im `recipe`-Tab beim `addLogEntry(...)`-Aufruf `servings: 1` entfernen,
  `factor: 1` bleibt.

### 5. Backup-Validierung

`src/features/backup/backupService.ts`:

- `isValidLogEntry`, Fall `'recipe'`: nur noch `typeof v.recipeId ===
'string'` prüfen (die `servings`-Prüfung entfällt). Ein **altes** Backup
  mit noch vorhandenem `servings`-Feld auf einem Rezept-Eintrag bleibt
  dadurch weiterhin gültig (das Feld wird beim nächsten Lesen über
  `normalizeLogEntry`, Punkt 4, automatisch gefaltet) — bewusst **kein**
  Bump von `BACKUP_SCHEMA_VERSION`, kurz kommentieren warum (analog zur
  bestehenden Begründung bei `factor`: additive/entfernte, rückwärts­
  kompatibel behandelte Felder brauchen keinen Versionssprung, im
  Unterschied zum kompletten Fehlen von `customFoods`, Instruktion 13).

### 6. Menü-Export ("Als Rezept exportieren")

`src/features/menu-builder/menuExportService.ts`:

- `menuToRecipe(menu, existingIds)`: Parameter `servings` entfernen, im
  erzeugten `Recipe`-Objekt kein `servings` mehr setzen.
- `isValidRecipe`: die `servings`-Prüfung (`typeof === 'number' &&
Number.isFinite && > 0`) ersatzlos entfernen.

`src/features/menu-builder/menuDetailView.ts`:

- `promptForServings()` komplett entfernen (kein `window.prompt` mehr für
  diesen Ablauf).
- `handleExportAsRecipe`: ruft `menuToRecipe(menu, existingIds)` jetzt
  direkt auf, ohne vorherige Portionenabfrage — der einzige verbleibende
  Abbruchgrund vor dem Download ist weiterhin "Menü ohne Zutaten" bzw.
  Lade-/Validierungsfehler der aktuellen `recipes.json`.

### 7. Tests

- `src/features/recipes/nutritionCalculator.test.ts`: Test zu
  `calculatePerServing` entfernen; `RECIPE`/`recipeWithUnknownFood`-
  Fixtures ohne `servings` (TS-Fehler zeigt automatisch jede vergessene
  Stelle); Kommentar "2 Portionen" bei `RECIPE` anpassen, da die Fixtur nur
  noch die Zutatenliste einer (fiktiven) einzelnen Portion beschreibt —
  Zahlenwerte der `calculateRecipeNutrition`-Assertions bleiben unverändert
  gültig (die Funktion selbst ändert sich nicht).
- `src/features/daily-log/dailyNutritionService.test.ts`: `RECIPE_X`-
  Fixtur ohne `servings`; Test "factor und servings multiplizieren sich
  bei Rezepten unabhängig voneinander" komplett entfernen (Szenario
  existiert nicht mehr); übrige Recipe-Log-Entry-Fixtures (`servings: 2`,
  `servings: 1`) auf reines `factor` umstellen, Erwartungswerte
  entsprechend neu herleiten (z.B. bisheriger Test mit `servings: 2,
factor: 1` → neu `factor: 2`, Ergebnis bleibt gleich).
- `src/features/menu-builder/menuExportService.test.ts`: alle
  `menuToRecipe(menu, N, …)`-Aufrufe auf `menuToRecipe(menu, …)` ohne
  Portionen-Argument umstellen; Assertions auf `recipe.servings` entfernen;
  in `isValidRecipe`-Tests die `servings`-Fälle durch andere Negativ-Fälle
  ersetzen oder entfernen, sofern sie ausschliesslich `servings` prüfen.
- Neuer Test in `src/data/indexedDbService.test.ts` (oder
  `dailyNutritionService.test.ts`, je nachdem wo `normalizeLogEntry`
  bereits getestet wird): ein gespeicherter Rezept-Eintrag mit altem
  `servings: 0.5, factor: 2` wird beim Lesen zu `factor: 1` gefaltet,
  `servings` ist im gelesenen Objekt nicht mehr vorhanden.
- `src/features/backup/backupService.test.ts`: falls dort ein
  Rezept-Log-Eintrag vorkommt (aktuell nicht der Fall, nur `food`-Typ) —
  keine Änderung nötig; andernfalls ergänzend ein Rezept-Eintrag ohne
  `servings` in den Roundtrip-Fixtures ergänzen, um die neue Form
  abzudecken.

---

## Was NICHT Teil dieses Auftrags ist

- **Kein Bump von `BACKUP_SCHEMA_VERSION`** und **kein Bump von
  `DB_VERSION`** — beide Änderungen sind rückwärtskompatibel über
  Lese-Normalisierung abgefangen (Punkt 4/5), analog zum Vorgehen bei
  `factor` (Instruktion 15).
- **Keine Änderung an `Menu`** — hatte nie `servings`, bleibt unangetastet.
- **Keine automatische Mehrfach-Export-Funktion** für "Als Rezept
  exportieren" (mehrere Menüs auf einmal in eine `recipes-updated.json`)
  — separates, eigenständiges Thema, nicht Teil dieser Instruktion.
- **Keine Änderung an `foodDatabaseListView.ts`/`ownFoodsPanel.ts`/
  `menuListView.ts`** — deren `.recipe-list__servings`-Klasse zeigt dort
  andere Inhalte (Nährwert-Kurzfassung bzw. Menü-Datum), hat nichts mit
  `Recipe.servings` zu tun und bleibt unverändert.
- **Keine Migration der Faktor-/Portionen-Werte direkt im Storage**
  (weder IndexedDB-Store noch Backup-Datei werden aktiv umgeschrieben) —
  die Faltung passiert ausschliesslich beim Lesen (Punkt 4), wie bei
  `normalizeLogEntry` bereits etabliert.

## Nach Abschluss

Bitte zeigen:

- Ein bestehendes Rezept öffnen (Rezeptliste → Detail) — keine
  "Portionen"-Zeile mehr, Nährwerttabelle/Chart zeigen weiterhin
  plausible Werte; für "Gemüsepfanne mit Teigwaren" insbesondere prüfen,
  dass die Energie/Nährwerte **identisch** zu vorher sind (nicht
  verdoppelt).
- Ein Rezept-Log-Eintrag aus **vor** dieser Instruktion (z.B. ein
  bestehender Eintrag mit `servings: 0.5`) im Tages-Log öffnen — zeigt nur
  noch ein Faktor-Feld, die Tagessumme an diesem Tag bleibt exakt gleich
  wie vorher (keine rückwirkende Verdoppelung/Halbierung).
- Einen neuen Rezept-Eintrag im Tages-Log hinzufügen, Faktor auf 2 stellen
  → Tagessumme verdoppelt sich wie bei einem Menü-Eintrag.
- "Als Rezept exportieren" auf einem Menü ausführen → kein
  Portionen-Prompt mehr, die heruntergeladene `recipes-updated.json`
  enthält das neue Rezept ohne `servings`-Feld.
- `npm test`, `npm run typecheck`, `npm run lint` und `npm run build`
  grün.
