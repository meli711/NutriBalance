# Instruktion 17: Nova-Score für eigene Zutaten, Rezepte, Menüs und Tages-Log

## Kontext
Aufbauend auf:
- `src/data/models/food.ts` — `FoodItem` (Instruktion 2), bisher ohne jede
  Angabe zum Verarbeitungsgrad eines Lebensmittels.
- `src/data/customFoodService.ts` — eigene Zutaten (Instruktion 13), Storage-
  Key `nutribalance:customFoods` **im `localStorage`**: `isValidCustomFoodItem`
  (Struktur-Prüfung), `parseStoredCustomFoods` (kaputte/unbekannte Einzel-
  einträge werden übersprungen, nicht die ganze Liste verworfen),
  `createCustomFood`/`applyCustomFoodInput` (bauen ein `FoodItem` aus dem
  Formular-Input).
- `src/features/ingredients/customFoodForm.ts` — Formular für eigene Zutaten
  (`NUTRIENT_FIELDS`, `parseOptionalNumber`, `CustomFoodInput`).
- `src/features/recipes/nutritionCalculator.ts` — `calculateNutrition(
  ingredients, foodsById)`: `NUTRIENT_DEFINITIONS`-Muster mit `incomplete`-
  Flag, sobald für eine Zutat kein Wert vorliegt; `calculateRecipeNutrition`/
  `calculatePerServing` für `Recipe`.
- `src/features/nutrition-summary/nutritionSummaryView.ts` —
  `renderNutritionSummary`: gemeinsame Anzeige "Bedarf vs. Aufnahme"-Chart +
  Nährwerttabelle, genutzt von `foodDetailView.ts`, `recipeDetailView.ts`,
  `menuDetailView.ts`, `menuBuilderView.ts` (Live-Vorschau) **und**
  `dailyLogView.ts` (Tagessumme) — **alle fünf** Aufrufer bekommen mit dieser
  Instruktion eine Nova-Anzeige, keine Ausnahme.
- Jeweils direkt vor dem `renderNutritionSummary(...)`-Aufruf gibt es bereits
  `ingredients` + `foodsById` im Scope: `foodDetailView.ts`
  (`calculateNutrition([{ foodId: current.id, amountGrams: 100 }], foodsById)`),
  `recipeDetailView.ts` (`calculatePerServing(recipe, foodsById)`),
  `menuDetailView.ts`/`menuBuilderView.ts` (`calculateNutrition(ingredients,
  foodsById)` bzw. `calculateNutrition(menu.ingredients, foodsById)`).
- `dailyLogView.ts` — `resolveEntry(entry)` löst jeden Log-Eintrag
  (`food`/`recipe`/`menu`) bereits auf ein konkretes `FoodItem`/`Recipe`/
  `Menu` auf (für das Anzeige-Label); dieselben Objekte reichen aus, um pro
  Eintrag **zusätzlich** eine Nova-Gruppe zu berechnen — Nova hängt nicht von
  `amountGrams`/`servings`/`factor` ab, anders als die Nährwert-Tagessumme
  (`dailyNutritionService.ts`, `sumDailyNutrition`), die deshalb unverändert
  bleibt (siehe Punkt 8).
- `scripts/convert-food-db.ts` — `toFoodItem` (generische BLV-Datenbank aus
  Excel, Instruktion 2), `assertFoodItem`/`mergeCustomProducts`
  (`quellen/eigene-produkte.json`, Instruktion 12).
- Instruktion 15 (Faktor pro Log-Eintrag) — Präzedenzfall für ein neues,
  **optionales** Feld auf bereits im Storage liegenden Daten: kein Bump von
  `BACKUP_SCHEMA_VERSION`/`DB_VERSION` nötig, solange ein fehlendes Feld beim
  Lesen defensiv mit einem Default/`null` aufgefangen wird statt Daten zu
  verlieren oder Einträge ungültig zu machen.
- Instruktion 16 (Typ-Farben) — Präzedenzfall für "neue visuelle Kategorie
  fürs Tages-Log": dort ein Punkt pro Zeile (`.daily-log__type-dot`),
  gesteuert über `data-entry-type`; dieselbe Zeile bekommt mit dieser
  Instruktion zusätzlich ein kleines Nova-Tag (Punkt 8).

Ziel: Zu jeder **eigenen** Zutat lässt sich optional eine **Nova-Gruppe**
(1–4, Klassifikation nach Verarbeitungsgrad) erfassen. Rezepte und Menüs
bekommen dafür **kein** eigenes gespeichertes Feld — ihre Nova-Einstufung
wird zur Laufzeit aus den referenzierten Zutaten abgeleitet (höchste, d.h.
am stärksten verarbeitete, bekannte Gruppe) und dort angezeigt, wo bereits
die Nährwert-Zusammenfassung inkl. Chart erscheint (`renderNutritionSummary`)
— das schliesst die Tagessumme im Tages-Log mit ein. Zusätzlich bekommt
**jede einzelne Zeile** im Tages-Log ein kleines Nova-Tag, damit auch ohne
Aufklappen der Tagessumme sofort sichtbar ist, wie ein einzelner Eintrag
einzustufen ist.

**Wichtig (Datensicherheit):** Bestehende eigene Zutaten im `localStorage`
(`nutribalance:customFoods`) haben noch **kein** `novaGroup`-Feld. Diese
Instruktion darf sie beim Lesen/Speichern nicht verwerfen oder beschädigen —
alte Einträge müssen weiterhin als gültig erkannt und normal geladen werden
(Nova dabei implizit "keine Angabe"), analog zum Vorgehen bei `factor` in
Instruktion 15. Gleiches gilt für ein bestehendes Daten-Backup: ein Import
ohne `novaGroup` in den `customFoods` darf nicht abgelehnt werden. Bestehende
Menüs im IndexedDB (`menus`-Object-Store) sind ohnehin nicht betroffen, da
`Menu` kein neues Feld bekommt (Nova wird ausschliesslich zur Laufzeit aus
den referenzierten Zutaten berechnet, siehe Punkt 5).

Die generische Schweizer Nährwertdatenbank (naehrwertdaten.ch/BLV) liefert
keine Zutatenlisten oder Zusatzstoff-Informationen, aus denen sich eine
Nova-Gruppe ableiten liesse — eine automatische Klassifizierung der >1000
generischen Einträge ist daher **nicht** Teil dieses Auftrags (siehe
"Was NICHT Teil ist").

---

## Aufgaben

### 1. Datenmodell
`src/data/models/food.ts`:
- Neues optionales Feld auf `FoodItem`: `novaGroup?: 1 | 2 | 3 | 4 | null`.
  Kommentar: kurze Erklärung der Nova-Klassifikation (4 Gruppen nach Grad/
  Zweck der industriellen Verarbeitung), `undefined`/`null` bedeutet "keine
  Angabe" — wie bei anderen unbekannten Werten im Projekt nicht geraten,
  nicht 0/1 vorbelegt.
- Bewusst optional statt Pflichtfeld: die generische BLV-Datenbank liefert
  dafür keine Grundlage und darf dadurch nicht ungültig werden.

### 2. Eigene Zutaten: erfassen + rückwärtskompatibel lesen
`src/data/customFoodService.ts`:
- `isValidCustomFoodItem`: `novaGroup` optional zulassen — gültig ist
  `undefined`, `null` oder eine der Zahlen `1`/`2`/`3`/`4`; jeder andere Wert
  (String, `5`, `0`, …) macht **nur diesen Eintrag** ungültig, exakt wie die
  bestehende Behandlung anderer kaputter Einzeleinträge in
  `parseStoredCustomFoods`. Das blosse **Fehlen** des Feldes darf niemals
  einen Eintrag ungültig machen — das deckt alte, vor dieser Instruktion
  angelegte Zutaten ab.
- `CustomFoodInput` um `novaGroup: 1 | 2 | 3 | 4 | null` ergänzen.
- `createCustomFood`/`applyCustomFoodInput`: `novaGroup` aus dem Input in das
  `FoodItem` übernehmen.
- Kein Migrations-/Normalisierungsschritt beim Lesen nötig (anders als
  `factor`/`normalizeLogEntry` in Instruktion 15): ein fehlendes `novaGroup`
  bleibt einfach `undefined` und wird von Punkt 5 wie "keine Angabe"
  behandelt — kein Neuschreiben des Storage beim blossen Anzeigen/Lesen.

### 3. Formular
`src/features/ingredients/customFoodForm.ts`:
- Neues Auswahlfeld direkt nach "Kategorie" (vor den Nährwertfeldern —
  inhaltlich näher an "was für ein Lebensmittel ist das" als an den
  Nährwerten):
  ```html
  <div class="field">
    <label for="custom-food-novaGroup">Nova-Gruppe (optional)</label>
    <select id="custom-food-novaGroup" name="novaGroup">
      <option value="">– keine Angabe –</option>
      <option value="1">1 – Unverarbeitet / gering verarbeitet</option>
      <option value="2">2 – Verarbeitete kulinarische Zutat</option>
      <option value="3">3 – Verarbeitetes Lebensmittel</option>
      <option value="4">4 – Ultra-verarbeitetes Lebensmittel</option>
    </select>
  </div>
  ```
- Kurzer Hinweistext darunter (`custom-food-form__hint`-Klasse
  wiederverwenden): ein Satz, dass Nova eine wissenschaftliche Einstufung
  nach Verarbeitungsgrad ist (Monteiro-Klassifikation), keine amtliche
  Kennzeichnung in CH/EU, und die Einordnung Ermessenssache bleibt.
- Vorbefüllen mit `existingFood?.novaGroup` (fehlt/​`null` → leere Option),
  Default bei neuer Zutat: "– keine Angabe –".
- Beim Speichern: leere Auswahl → `null`, sonst `Number(select.value) as
  1 | 2 | 3 | 4`.

### 4. Eigene Markenprodukte (Repo-Datei, optional nutzbar)
- `scripts/convert-food-db.ts`: **keine Änderung** an `assertFoodItem`
  nötig — `novaGroup` ist optional und wird dort wie andere optionale Felder
  nicht geprüft; ein Eintrag in `quellen/eigene-produkte.json` **kann**
  freiwillig ein `novaGroup` mitbringen und übersteht `mergeCustomProducts`
  unverändert.
- `toFoodItem` (generische BLV-Einträge) bekommt bewusst **kein**
  `novaGroup` gesetzt — bleibt `undefined`, da die Quelle keine Datengrundlage
  liefert.
- `README.md`, Abschnitt "Datenquellen": ein Satz ergänzen, dass
  `eigene-produkte.json`-Einträge optional ein `novaGroup` (1–4) enthalten
  können.

### 5. Berechnung: Nova-Gruppe einer Zutatenliste
`src/features/recipes/nutritionCalculator.ts`:
- Neuer Typ `NovaSummary { group: 1 | 2 | 3 | 4 | null; incomplete: boolean }`.
- Neue Funktion `calculateNovaGroup(ingredients: RecipeIngredient[],
  foodsById: Map<string, FoodItem>): NovaSummary`:
  - für jede Zutat `food = foodsById.get(ingredient.foodId)` nachschlagen;
    fehlt der Food-Eintrag oder ist `food.novaGroup` `null`/`undefined` →
    `incomplete = true` setzen, Zutat sonst ignorieren (analog zum
    `incomplete`-Umgang in `calculateNutrition`)
  - `group` = die **höchste** (am stärksten verarbeitete) unter den
    bekannten Gruppen, oder `null`, wenn **keine** Zutat eine Gruppe hat
  - bewusst **unabhängig von `amountGrams`/Portionen** — Nova bewertet die
    Art der Zutat, nicht deren Menge (anders als `calculateNutrition`); bei
    `recipeDetailView.ts` deshalb direkt mit `recipe.ingredients` aufrufen,
    **nicht** über `calculatePerServing`
- Tests in `nutritionCalculator.test.ts`: leere Zutatenliste (`group: null,
  incomplete: false`), eine Zutat ohne `novaGroup` (`incomplete: true, group:
  null`), zwei Zutaten mit Gruppe 2 und 4 (`group: 4`), eine unbekannte
  `foodId` (`incomplete: true`), eine Zutat mit Gruppe 3 + eine unbekannte
  `foodId` (`group: 3, incomplete: true` — bekannte Gruppen zählen trotz
  einzelner Lücke).

### 6. Anzeige in der Nährwert-Zusammenfassung
`src/features/nutrition-summary/nutritionSummaryView.ts`:
- `NutritionSummaryOptions` um `novaGroup: NovaSummary` erweitern (Pflicht­
  feld — **jeder** der fünf Aufrufer berechnet es, siehe Punkt 7 und 8, keine
  Ausnahme mehr).
- Neues, kleines Label-Mapping `src/utils/novaLabels.ts`, analog zu
  `NUTRIENT_LABELS` in `nutrientLabels.ts`:
  ```ts
  export const NOVA_LABELS: Record<1 | 2 | 3 | 4, string> = {
    1: 'Unverarbeitet / gering verarbeitet',
    2: 'Verarbeitete kulinarische Zutat',
    3: 'Verarbeitetes Lebensmittel',
    4: 'Ultra-verarbeitetes Lebensmittel',
  }
  ```
- Im Markup von `renderNutritionSummary` einen schmalen Badge/Absatz direkt
  unter der Überschrift "Bedarf vs. Aufnahme" (vor dem Chart-Container)
  ergänzen:
  - bekannte Gruppe: `Nova ${novaGroup.group} – ${NOVA_LABELS[novaGroup.group]}`
  - `group === null`: `Nova: keine Angabe` (dezent anzeigen statt komplett
    auszublenden — kein Layout-Sprung zwischen Zutaten mit/ohne Angabe)
  - `incomplete: true` **und** `group !== null`: zusätzlicher Hinweis
    analog zum bestehenden `recipe-detail__incomplete`-Stern: "* Für
    mindestens eine Zutat ist keine Nova-Gruppe hinterlegt – Einstufung
    ggf. unvollständig."
- Styling: neue Klasse `.nova-badge` (schmale Pille: `border: 1px solid
  var(--color-border)`, `background-color: var(--color-surface)`,
  `border-radius: 999px`) + `.nova-badge__incomplete` (analog zu
  `.recipe-detail__incomplete`: `color: var(--color-support)`, `cursor:
  help`). **Keine neue Farbskala** nach Gruppe (z.B. grün→rot) ohne
  vorherige Abstimmung mit der Nutzerin — analog zum Vorgehen bei den
  Typ-Farben (Instruktion 16, dort vorab per Mockup bestätigt).

### 7. Aufrufstellen: Zutat/Rezept/Menü/Menü-Builder
Je Aufrufer direkt neben dem bestehenden `calculateNutrition`/
`calculatePerServing`-Aufruf, mit denselben `ingredients`/`foodsById`:
- `src/features/ingredients/foodDetailView.ts`: `calculateNovaGroup([{
  foodId: current.id, amountGrams: 100 }], foodsById)`.
- `src/features/recipes/recipeDetailView.ts`: `calculateNovaGroup(
  recipe.ingredients, foodsById)` (nicht über `calculatePerServing`, siehe
  Punkt 5).
- `src/features/menu-builder/menuDetailView.ts`: `calculateNovaGroup(
  menu.ingredients, foodsById)`.
- `src/features/menu-builder/menuBuilderView.ts`: `calculateNovaGroup(
  ingredients, foodsById)` (gleiche Variablen wie beim dortigen
  `calculateNutrition(ingredients, foodsById)`) — die Live-Vorschau
  aktualisiert die Nova-Anzeige damit automatisch bei jeder Änderung der
  Zutatenliste.
- Jeweils das Ergebnis als `novaGroup` an `renderNutritionSummary(...)`
  übergeben.

### 8. Tages-Log: pro Zeile + Tages-Aggregat
`src/features/daily-log/dailyLogView.ts`:
- `ResolvedEntry` um `nova: NovaSummary | null` erweitern (`null` nur bei
  `missing: true`, wenn die referenzierte Zutat/das Rezept/Menü nicht mehr
  existiert).
- `resolveEntry(entry)` erweitern: zusätzlich zum bestehenden Label je Typ
  auch die Nova-Gruppe berechnen — die dafür nötigen Objekte sind bereits
  geladen bzw. mit demselben Muster wie in `recipeDetailView.ts`/
  `menuDetailView.ts` ladbar:
  - `food`: `calculateNovaGroup([{ foodId: entry.foodId, amountGrams:
    entry.amountGrams }], new Map([[food.id, food]]))`
  - `recipe`: Zutaten-Foods laden (`Promise.all` + `getFoodById`, analog zu
    `recipeDetailView.ts`) und `calculateNovaGroup(recipe.ingredients,
    foodsById)`
  - `menu`: analog mit `menu.ingredients`
- Neue kleine Funktion `summarizeDayNova(resolved: ResolvedEntry[]):
  NovaSummary` — Maximum der bereits pro Eintrag berechneten `nova.group`-
  Werte über alle **nicht** `missing`-Einträge, `incomplete: true` sobald
  ein Eintrag `missing` ist oder selbst `incomplete` war. **Kein** Umweg
  über `sumDailyNutrition`/`calculateDailyNutrition` nötig — Nova ist
  unabhängig von Menge/Faktor, das Maximum über die Einzelwerte genügt.
- Beim bestehenden `renderNutritionSummary(...)`-Aufruf für die Tagessumme:
  `novaGroup: summarizeDayNova(resolved)` übergeben — die Tagessumme zeigt
  damit automatisch dasselbe Nova-Badge wie Zutat-/Rezept-/Menü-Detail
  (Punkt 6), keine separate Anzeige nötig.
- **Pro Zeile** zusätzlich ein kompaktes Tag (kein volles Badge, dafür zu
  wenig Platz neben Faktor-/Portionen-Input und Typ-Punkt): neue Klasse
  `.daily-log__nova-tag` (kleine Pille, `min-width: 1.75rem`, `height:
  1.5rem`, `border-radius: 999px`, `font-size: 0.75rem`, `font-weight:
  700`), Inhalt `N${group}` (z.B. `N4`), zusätzlich `*` bei `incomplete`,
  oder `–` mit `.daily-log__nova-tag--unknown` (gestrichelter Rand) wenn
  `group === null`. `title`-Tooltip mit vollem Label (`NOVA_LABELS`).
  Platzierung: nach dem Label, vor dem Entfernen-Button. Bei `missing:
  true` kein Tag (wie schon Faktor-/Portionen-Input dort ausgeblendet).
- `dailyNutritionService.ts`/`sumDailyNutrition`/`calculateDailyNutrition`
  **nicht anfassen** — bleiben ausschliesslich für die Nährstoff-Tagessumme
  zuständig, Nova läuft komplett daneben über `resolveEntry`/
  `summarizeDayNova`.

### 9. Backup
- `src/features/backup/backupService.ts`, `validateBackupData`/
  `isValidCustomFoodItem`-Nutzung: **keine Änderung nötig**, da
  `isValidCustomFoodItem` (Punkt 2) bereits zentral für Backup-Validierung
  **und** `localStorage`-Parsing verwendet wird — ein `novaGroup` in einem
  importierten Backup wird automatisch mitgeprüft, ein fehlendes
  akzeptiert.
- **Kein** Bump von `BACKUP_SCHEMA_VERSION` (aktuell `2`) — `novaGroup` ist
  ein rein additives, optionales Feld auf bereits vorhandenen
  `customFoods`-Einträgen; anders als beim kompletten Fehlen von
  `customFoods` selbst (Instruktion 13) geht beim Fehlen von `novaGroup` in
  einem alten Backup nichts verloren (analog zur Begründung bei `factor`,
  Instruktion 15 — bitte im Code kurz kommentieren, warum hier bewusst kein
  Bump erfolgt).

### 10. Tests
- `src/data/customFoodService.test.ts`: `isValidCustomFoodItem` mit
  fehlendem `novaGroup` (gültig), `novaGroup: null` (gültig), `novaGroup: 3`
  (gültig), `novaGroup: 5`/`novaGroup: '3'` (ungültig); `createCustomFood`/
  `applyCustomFoodInput` übernehmen `novaGroup` korrekt.
- `src/features/recipes/nutritionCalculator.test.ts`: siehe Testfälle in
  Punkt 5.
- `src/features/backup/backupService.test.ts`: bestehenden Roundtrip-Test
  um eine eigene Zutat **mit** `novaGroup` erweitern; ein Backup-Fixture
  ohne `novaGroup` in `customFoods` bleibt weiterhin importierbar (nicht
  abgelehnt).
- Kein neuer Test für `summarizeDayNova`/die Tages-Log-Zeilen — analog zur
  bestehenden Projekt-Konvention (Instruktion 14) sind `dailyLogView.ts` &
  Co. reine DOM-Views ohne eigene Tests; `calculateNovaGroup` selbst ist
  über Punkt 5 abgedeckt, und `summarizeDayNova` ist eine dünne Schicht
  darüber (Maximum über bereits getestete Werte).

---

## Was NICHT Teil dieses Auftrags ist
- **Verlauf** (`src/features/history/`, Instruktion 11) — Nova ist keine
  über Tage summierbare Grösse wie ein Nährstoff; eine Wochen-/
  Monatsansicht dafür ist nicht Teil dieser Instruktion.
- **Keine automatische/heuristische Zuweisung** von Nova-Gruppen an die
  generische BLV-Datenbank (>1000 Einträge) — die Quelle liefert keine
  Zutatenlisten/Zusatzstoff-Infos, eine kategorienbasierte Schätzung wäre
  methodisch nicht belastbar. Generische Einträge bleiben dauerhaft ohne
  Angabe (`novaGroup: undefined`), bis sie ggf. manuell in
  `eigene-produkte.json` nachgepflegt werden (Punkt 4).
- **Keine Farbskala nach Nova-Gruppe** (z.B. grün/gelb/orange/rot) — nur
  neutraler Text/Badge (Punkt 6/8). Kann als eigene, kleine Folge-
  Instruktion nachgezogen werden, analog zum Vorgehen bei den Typ-Farben
  (Instruktion 16: dort vorab per Mockup mit der Nutzerin abgestimmt).
- **Keine Anzeige in Listen-Ansichten oder der Zutatensuche**
  (`foodDatabaseListView.ts`, `ownFoodsPanel.ts`, `recipeListView.ts`,
  `menuListView.ts`, `foodPickerControl.ts`) — nur in den Detail-/
  Zusammenfassungs-Ansichten (Punkt 6/7) und im Tages-Log (Punkt 8).
- **Keine Änderung an `Menu`/`Recipe`/IndexedDB** (`menus`-Object-Store,
  `DB_VERSION`) — Nova wird für Rezepte/Menüs ausschliesslich zur Laufzeit
  aus den referenzierten Zutaten berechnet (Punkt 5), nicht gespeichert.
  Damit besteht für bestehende Menüs im IndexedDB **kein** Migrationsrisiko.
- **Keine Änderung an `dailyNutritionService.ts`/`sumDailyNutrition`/
  `calculateDailyNutrition`** — die Nährstoff-Tagessumme (inkl. `factor`-
  Multiplikation, Instruktion 15) bleibt komplett unangetastet; Nova läuft
  für den Tages-Log über einen eigenen, unabhängigen Weg (Punkt 8).
- **Kein Bump von `BACKUP_SCHEMA_VERSION`** (Punkt 9) und **keine
  Normalisierungsfunktion** wie `normalizeLogEntry` (Instruktion 15) für
  `novaGroup` — ein fehlendes Feld ist bereits über die optionale
  Typisierung (`undefined`) und `calculateNovaGroup`s `incomplete`-Logik
  abgedeckt, ohne eigenen Lese-Normalisierungsschritt.
- **Keine Pflichtprüfung** von `novaGroup` in `scripts/convert-food-db.ts`s
  `assertFoodItem` — bleibt wie alle anderen optionalen Felder ungeprüft.

## Nach Abschluss
Bitte zeigen:
- Eine **vor** dieser Instruktion im `localStorage` angelegte eigene Zutat
  öffnen (z.B. eine bestehende Test-Zutat ohne `novaGroup` im Storage) —
  lädt weiterhin korrekt, Formular zeigt "– keine Angabe –" vorbefüllt,
  keine anderen Felder gehen dabei verloren.
- Eine neue eigene Zutat mit Nova-Gruppe 4 erfassen (z.B. "Energy Drink")
  → in der Zutaten-Detailansicht erscheint das Nova-Badge "Nova 4 –
  Ultra-verarbeitetes Lebensmittel".
- Ein Menü **und** ein Rezept bauen, das u.a. diese Zutat sowie eine
  Zutat ohne Nova-Angabe enthält → Menü-Detail, Rezept-Detail und
  Menü-Builder-Live-Vorschau zeigen jeweils "Nova 4" mit dem
  Unvollständig-Hinweis (mindestens eine Zutat ohne Angabe).
- Diese Zutat/dieses Menü/Rezept im Tages-Log erfassen → pro Zeile
  erscheint das kompakte Nova-Tag (`N4`, ggf. mit `*`), und die
  Tagessumme unten zeigt das gleiche Nova-Badge wie die Detailansichten
  (höchste Gruppe über alle Einträge des Tages).
- Ein Daten-Backup exportieren/importieren mit einer eigenen Zutat inkl.
  Nova-Gruppe → Wert bleibt erhalten; ein **altes** Backup
  (`schemaVersion: 2`, ohne `novaGroup` in den `customFoods`) lässt sich
  weiterhin ohne Fehler importieren, betroffene Zutaten zeigen danach
  "keine Angabe".
- `npm test`, `npm run typecheck`, `npm run lint` und `npm run build` grün.
