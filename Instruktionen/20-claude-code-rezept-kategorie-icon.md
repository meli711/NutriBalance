# Instruktion 20: Rezept-Kategorie im JSON, automatische Icon-Zuordnung

## Kontext

Aufbauend auf:

- `src/utils/mealCategoryIcon.ts` (Instruktion 7, Look & Feel) — bisher eine
  fest im Code hinterlegte `CATEGORY_BY_RECIPE_ID: Record<string,
MealCategory>`-Tabelle (Rezept-**ID** → `'breakfast' | 'main' |
'snack'`), bewusst **nicht** im Datenmodell, sondern rein in der
  View-Schicht — Begründung damals: die Instruktion war ein reiner
  Design-Pass ohne Datenmodell-Änderungen. `getMealCategory(recipeId)`
  schlägt darin nach, `renderMealCategoryIcon(category)` rendert eines von
  drei Inline-SVGs (Sonnenaufgang/Teller/Blatt).
- `src/features/recipes/recipeListView.ts` — einziger Aufrufer:
  `renderItems` ruft `getMealCategory(recipe.id)` auf und zeigt bei
  bekannter Kategorie das Icon vor dem Rezeptnamen.
- `src/features/recipes/models/recipe.ts` — `Recipe` hat aktuell kein Feld
  für die Mahlzeiten-Kategorie.
- `public/data/recipes.json` — 8 Einträge; 7 davon sind über
  `CATEGORY_BY_RECIPE_ID` kategorisiert, das 8. ("Ice Kaffee",
  `ice-kaffee-mub0zntv-erl0`) wurde von Hand über "Als Rezept exportieren"
  ergänzt (Instruktion 8/19) und taucht in der Tabelle **nicht** auf — hat
  daher aktuell kein Icon. Keine der drei bestehenden Kategorien
  (Frühstück/Hauptmahlzeit/Snack) passt wirklich auf ein Getränk.
- `src/features/menu-builder/menuDetailView.ts`/`menuExportService.ts` —
  "Als Rezept exportieren": `handleExportAsRecipe` baut über
  `menuToRecipe(menu, existingIds)` ein neues `Recipe`-Objekt und hängt es
  an die aktuell geladene `recipes.json` an; seit Instruktion 19 ohne
  jede Abfrage (der frühere Portionen-Prompt wurde ersatzlos entfernt).
  `isValidRecipe` prüft die Struktur eines `Recipe`-Objekts, u.a. für die
  aktuell geladene `recipes.json` **und** das frisch erzeugte Objekt vor
  dem Download.
- **Wichtig, warum die bisherige Lösung unpraktisch ist:** Rezepte werden
  laut Projekt-Konvention grösstenteils von Hand in `recipes.json`
  gepflegt (siehe "Ice Kaffee" oben) — eine zusätzliche, separate
  Code-Tabelle nach **ID** zu pflegen, die man beim Hinzufügen eines
  Rezepts leicht vergisst, ist fehleranfällig. Die Kategorie soll deshalb
  direkt am Rezept selbst in `recipes.json` stehen.

Ziel: `Recipe` bekommt ein neues, **optionales** Feld `category`. Der Wert
ist bewusst nicht ein technischer Code (`'breakfast'` etc.), sondern das
**lesbare deutsche Label selbst** (`"Frühstück"`, `"Hauptmahlzeit"`,
`"Snack"`, neu `"Getränk"`) — die Angabe liest sich damit beim manuellen
Bearbeiten von `recipes.json` wie ein Kommentar/eine Beschriftung, ganz
ohne Nachschlagen einer Code-Tabelle. Das Icon in der Rezeptliste wird
direkt aus diesem Feld abgeleitet, die bisherige ID→Kategorie-Tabelle
entfällt vollständig. "Als Rezept exportieren" fragt neu (optional) danach,
damit neu exportierte Rezepte gleich eine Kategorie mitbekommen, statt sie
nachträglich von Hand im JSON ergänzen zu müssen.

---

## Aufgaben

### 1. Datenmodell

`src/features/recipes/models/recipe.ts`:

- Neues optionales Feld `category?: MealCategory` auf `Recipe`
  (`MealCategory`-Typ aus `utils/mealCategoryIcon.ts` importieren, siehe
  Punkt 2). Kommentar: Wert ist das lesbare deutsche Label direkt (dient
  beim manuellen Bearbeiten von `recipes.json` zugleich als
  Dokumentation), fehlt/unbekannt → kein Icon in der Rezeptliste.

### 2. `mealCategoryIcon.ts` umbauen

`src/utils/mealCategoryIcon.ts`:

- `MealCategory` von `'breakfast' | 'main' | 'snack'` auf die deutschen
  Labels umstellen: `'Frühstück' | 'Hauptmahlzeit' | 'Snack' | 'Getränk'`
  (neue vierte Kategorie, siehe Kontext).
- `CATEGORY_BY_RECIPE_ID` und `CATEGORY_LABELS` **ersatzlos entfernen** —
  nicht mehr nötig, der Kategorie-Wert ist bereits das Label.
- Neue exportierte Konstante `MEAL_CATEGORIES: readonly MealCategory[]` mit
  allen vier Werten (Reihenfolge wie oben) — zentrale Quelle für Punkt 5
  (Export-Prompt) und Punkt 6 (Validierung), damit nicht an zwei Stellen
  dieselbe Liste gepflegt werden muss.
- Neue exportierte Funktion `isMealCategory(value: unknown): value is
MealCategory`, prüft Mitgliedschaft in `MEAL_CATEGORIES`.
- `CATEGORY_ICONS`: bestehende drei Einträge bleiben (Schlüssel auf die
  deutschen Labels umbenannt), neuer vierter Eintrag `'Getränk'` — Glas mit
  Trinkhalm, gleicher Linien-Stil (kein Fill, `stroke-width` wie die
  anderen drei):
  ```
  <path d="M8 4h8l-.8 13.2a2 2 0 0 1-2 1.8h-2.4a2 2 0 0 1-2-1.8L8 4Z" />
  <path d="M9 8h6" />
  <path d="M14 3v3" />
  ```
- `getMealCategory(recipeId)` entfernen (keine ID-basierte Zuordnung mehr).
- `renderMealCategoryIcon(category: MealCategory)`: `label` jetzt direkt
  `category` (kein `CATEGORY_LABELS`-Lookup mehr nötig, siehe oben).

### 3. Aufrufstelle anpassen

`src/features/recipes/recipeListView.ts`:

- `getMealCategory(recipe.id)` durch direktes Lesen von `recipe.category`
  ersetzen, dabei über `isMealCategory` absichern (ein unbekannter/
  verschriebener Wert im JSON zeigt dann einfach kein Icon, statt
  `undefined` ins Markup zu rendern):
  ```ts
  const category = recipe.category
  // …
  ${category && isMealCategory(category) ? `<span class="recipe-list__icon">${renderMealCategoryIcon(category)}</span>` : ''}
  ```

### 4. `recipes.json` migrieren

- Jedem der 7 bestehenden, bisher über `CATEGORY_BY_RECIPE_ID`
  kategorisierten Rezepte das Feld `"category"` mit dem bisherigen Icon
  entsprechenden Label hinzufügen (1:1 Übernahme, keine Icons ändern sich):
  `overnight-oats-banane` → `"Frühstück"`, `ruehrei-vollkornbrot` →
  `"Frühstück"`, `joghurt-honig-nuesse` → `"Snack"`,
  `pouletbrust-reis-broccoli` → `"Hauptmahlzeit"`,
  `lachs-kartoffeln-spinat` → `"Hauptmahlzeit"`,
  `quinoa-bowl-avocado-tomate` → `"Hauptmahlzeit"`,
  `magerquark-apfel-honig` → `"Snack"`, `gemuesepfanne-teigwaren` →
  `"Hauptmahlzeit"`.
- `ice-kaffee-mub0zntv-erl0` ("Ice Kaffee") bekommt neu `"category":
"Getränk"`.

### 5. Export-Flow: Kategorie optional erfragen

`src/features/menu-builder/menuExportService.ts`:

- `menuToRecipe(menu, existingIds, category?: MealCategory)`: neuer,
  optionaler dritter Parameter; ist er gesetzt, wird `category` auf das
  erzeugte `Recipe` übernommen, sonst bleibt das Feld weg (kein
  `category: undefined` im JSON, siehe `JSON.stringify`-Verhalten —
  bewusst nicht setzen statt auf `undefined` setzen).

`src/features/menu-builder/menuDetailView.ts`:

- Neue kleine Funktion `promptForCategory(): MealCategory | undefined`
  (analog im Aufbau zum entfernten `promptForServings` aus Instruktion 19,
  aber **nicht blockierend** — anders als dort gibt es hier keinen
  Fehlerfall, der den Export abbricht):
  ```ts
  function promptForCategory(): MealCategory | undefined {
    const options = MEAL_CATEGORIES.join(' / ')
    const raw = window.prompt(
      `Kategorie fürs Icon in der Rezeptliste (${options}) — leer lassen für keine:`,
      '',
    )
    const trimmed = raw?.trim()
    return trimmed && isMealCategory(trimmed) ? trimmed : undefined
  }
  ```
  Ein leerer/abgebrochener Prompt **oder** ein nicht erkannter Text führen
  gleichermassen zu `undefined` (kein Icon) — **kein** Fehlerhinweis/Retry,
  da die Kategorie rein kosmetisch ist und den Export nicht blockieren
  soll (bewusster Unterschied zum alten, blockierenden
  Portionen-Prompt).
- `handleExportAsRecipe`: `promptForCategory()` aufrufen, Ergebnis an
  `menuToRecipe(menu, existingIds, category)` übergeben.

### 6. Validierung

`src/features/menu-builder/menuExportService.ts`, `isValidRecipe`:

- `category` **nicht** streng gegen `MEAL_CATEGORIES` prüfen (bewusst
  lax, wie bei `instructions`) — nur `v.category === undefined ||
typeof v.category === 'string'`. Begründung: ein unbekannter/späterer
  Kategorie-Wert (z.B. eine fünfte Kategorie, von Hand in `recipes.json`
  ergänzt, bevor der Code sie kennt) soll nicht die **ganze** Datei als
  ungültig zurückweisen und damit jeden weiteren Export blockieren — im
  schlimmsten Fall fehlt nur das Icon (siehe `isMealCategory`-Absicherung
  in Punkt 3).

### 7. Tests

- `src/features/menu-builder/menuExportService.test.ts`:
  `menuToRecipe(menu, existingIds, 'Snack')` setzt `category: 'Snack'`;
  ohne dritten Parameter bleibt `category` `undefined` (Property fehlt im
  Objekt, nicht nur `undefined`-wertig, prüfen mit `'category' in
recipe` bzw. `Object.hasOwn`); `isValidRecipe` akzeptiert ein Objekt
  mit `category: 'Snack'` sowie mit `category: 'irgendwas-unbekanntes'`
  (bewusst lax, siehe Punkt 6) und lehnt `category: 3` ab (falscher Typ).
- Kein neuer Test für `mealCategoryIcon.ts`/`recipeListView.ts` — reine
  Konstanten-Tabelle bzw. DOM-View, analog zur bestehenden
  Projekt-Konvention (siehe Instruktion 17, Punkt 10).

---

## Was NICHT Teil dieses Auftrags ist

- **Keine Laufzeit-Validierung von `recipes.json` beim Laden**
  (`recipeService.ts#getAllRecipes`) — bleibt wie bisher ein ungeprüfter
  Cast; `isValidRecipe` wird ausschliesslich beim Export genutzt (siehe
  Punkt 6), nicht beim normalen App-Start.
- **Keine Migration/Icon-Zuweisung für weitere, zukünftige Kategorien**
  über die vier genannten hinaus — wer eine neue Kategorie braucht, ergänzt
  `MEAL_CATEGORIES`/`CATEGORY_ICONS` von Hand im Code.
- **Keine Änderung an `Menu`** — Menüs haben weiterhin keine Kategorie/kein
  Icon; nur `Recipe` bekommt das neue Feld.
- **Keine Pflichtangabe** — `category` bleibt optional, ein Rezept ohne
  Kategorie ist weiterhin ein vollständig gültiges Rezept (zeigt nur kein
  Icon).

## Nach Abschluss

Bitte zeigen:

- Rezeptliste öffnen — alle 7 bisherigen Rezepte zeigen weiterhin exakt
  dasselbe Icon wie vorher, "Ice Kaffee" zeigt neu das Getränke-Icon.
- Ein Menü über "Als Rezept exportieren" exportieren, im Prompt z.B.
  "Snack" eingeben → die heruntergeladene `recipes-updated.json` enthält
  das neue Rezept mit `"category": "Snack"`.
- Denselben Export wiederholen und den Prompt leer lassen/abbrechen → das
  neue Rezept hat kein `category`-Feld, erscheint in der Liste ohne Icon.
- Ein Rezept in `recipes.json` von Hand mit einer erfundenen Kategorie
  (z.B. `"category": "Dessert"`) versehen → App stürzt nicht ab, Rezept
  erscheint einfach ohne Icon.
- `npm test`, `npm run typecheck`, `npm run lint` und `npm run build`
  grün.
