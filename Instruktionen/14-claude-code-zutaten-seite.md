# Instruktion 14: Neuer Nav-Reiter "Zutaten" (Datenbank-Browser + eigene Zutaten)

## Kontext
Aufbauend auf:
- `src/app/appNav.ts` — Hauptnavigation im Header (`NavSection`, `NAV_ITEMS`)
- `src/app/main.ts` — Routing (`navigateTo`, je Sektion eine `showXyz`-Funktion,
  kein URL-Router — reiner In-Memory-State)
- `src/data/foodDatabaseService.ts` — `getAllFoods`/`searchFoodsByName`/
  `rankFoodsByQuery`, liefert generische + Build-Zeit-Markenprodukte
  (Instruktion 12) + eigene, lokal erfasste Zutaten (Instruktion 13, via
  `mergeFoods`) bereits zusammengeführt
- `src/features/custom-foods/` (Instruktion 13) — `customFoodsSectionView.ts`
  (Liste + Formular), `customFoodForm.ts`, bisher eingebunden in
  `src/features/profile/profileForm.ts`
- `src/features/recipes/recipeListView.ts` / `recipeDetailView.ts` — Muster
  für Liste → Detail (Zutatentabelle + `renderNutritionSummary`)
- `src/features/nutrition-summary/nutritionSummaryView.ts` — gemeinsame
  Nährwerttabelle **inkl. Chart** (Bedarf-Vergleich), nimmt `NutrientValues`
  + `NutrientRequirement[]` + `UserProfile` entgegen; genutzt von
  Rezept-/Menü-Detail und Menü-Builder-Live-Vorschau
- `src/features/recipes/nutritionCalculator.ts` — `calculateNutrition(
  ingredients, foodsById)`, funktioniert auch mit einer einzelnen
  "Zutatenliste" ohne `Recipe`/`servings` (bereits für Menüs genutzt)
- `src/features/daily-log/addLogEntryView.ts` — Vorlage für einen
  Umschalter zwischen zwei Ansichten (`.nutrient-chart__toggle`,
  Tab-Buttons mit `aria-pressed`), dort für "Rezept/Menü/Zutat"

Ziel: Ein neuer Reiter **"Zutaten"** in der Hauptnavigation macht die
Lebensmitteldatenbank (generisch **und** eigene) direkt durchsuchbar und
zeigt zu jedem Eintrag die Nährwerte inkl. Chart — bisher liess sich ein
Lebensmittel nur indirekt über ein Rezept/Menü oder den Tages-Log-Eintrag
ansehen. Gleichzeitig zieht der bestehende "Eigene Zutaten"-Abschnitt
(Instruktion 13) von der Profilseite hierher um, da er inhaltlich besser zu
den übrigen Zutaten passt als zu Profil/Bedarf/Backup.

> **Update nach Umsetzung:** `customFoodsSectionView.ts` (Instruktion 13)
> wurde **nicht** unverändert wiederverwendet, sondern aufgeteilt — damit
> auch eigene Zutaten dieselbe Detailansicht mit Nährwerttabelle+Chart
> bekommen wie generische (siehe "Nach Abschluss": ein Klick auf eine
> eigene Zutat sollte dieselbe Detailansicht zeigen, nicht direkt das
> Bearbeiten-Formular):
> - `ownFoodsPanel.ts` (neu) übernimmt die Liste + das Erfassen einer
>   **neuen** Zutat (dafür gibt es ja noch keine Detailansicht).
> - `foodDetailView.ts` (neu) übernimmt Ansicht + Bearbeiten + Löschen einer
>   bestehenden Zutat — sowohl generisch (read-only) als auch eigen.
> - `customFoodsSectionView.ts` wurde daher komplett entfernt (gelöscht,
>   nicht nur umgezogen); `customFoodForm.ts` bleibt bestehen und zog nach
>   `src/features/ingredients/customFoodForm.ts` um, da es jetzt von beiden
>   neuen Dateien gebraucht wird.

---

## Aufgaben

### 1. Navigation neu ordnen + neue Sektion
`src/app/appNav.ts`:
- `NavSection` um `'zutaten'` ergänzen.
- `NAV_ITEMS`-Reihenfolge ändern von
  `Log, Verlauf, Mein Bedarf, Rezepte, Menüs, Profil` auf
  **`Profil, Mein Bedarf, Log, Verlauf, Zutaten, Menüs, Rezepte`**
  (Label `'zutaten'` → "Zutaten", zwischen "Verlauf" und "Menüs").

`src/app/main.ts`:
- Neuer Fall `'zutaten'` in `navigateTo()` → `showIngredients(profile)`.
- Neue Funktionen analog zu `showRecipeList`/`showRecipeDetail`:
  `showIngredients(profile)` (Liste/Switch) und
  `showIngredientDetail(profile, foodId, onBack)` (Detail mit Chart) —
  gleiches Liste-→-Detail-Muster wie bei Rezepten.

### 2. Neues Feature-Modul `src/features/ingredients/`
- `ingredientsPageView.ts`: Seiten-Rahmen mit `<h1>Zutaten</h1>`, Umschalter
  darunter (`.nutrient-chart__toggle`-Muster aus `addLogEntryView.ts`):
  **"Zutaten"** (generische Datenbank inkl. Instruktion-12-Markenprodukte,
  read-only) vs. **"Eigene Zutaten"** (Instruktion 13). Umschalten rendert
  den Tab-Inhalt komplett neu (Suchzustand wird dabei zurückgesetzt) und
  reicht `onSelectFood(foodId, tab)` nach oben durch — `tab` merkt sich, von
  welchem Tab aus navigiert wurde, damit "Zurück" aus der Detailansicht in
  denselben Tab zurückführt (`main.ts`: `showIngredients(profile,
  initialTab)`). Zusätzlich ein "Zurück"-Button (→ Tages-Log), analog zu
  `recipeListView.ts`/`menuListView.ts`.
- `foodDatabaseListView.ts`: Liste der generischen Datenbank
  - leeres Suchfeld → Hinweistext "Suchbegriff eingeben…" (Datenbank hat
    >1000 Einträge, kein sinnvolles Rendern der Komplettliste, analog zur
    Mindestlänge in `foodPickerControl.ts`, hier `MIN_QUERY_LENGTH = 2`)
  - ab 2 Zeichen: `searchFoodsByName` (mischt bereits eigene Zutaten mit,
    siehe Punkt 4) → Ergebnisliste analog `recipeListView.ts`
    (`<ul class="recipe-list__items">`), begrenzt auf `RESULT_LIMIT = 50`
    Treffer + Hinweis "+N weitere Treffer", Klick → `onSelectFood(foodId)`
  - `requestId`-Zähler gegen veraltete/überholte Async-Antworten (gleiches
    Muster wie `foodPickerControl.ts`)
- `ownFoodsPanel.ts`: Liste der eigenen Zutaten (`getCustomFoods()`) mit
  eigenem Suchfeld (`rankFoodsByQuery`, leere Suche zeigt sofort die volle,
  alphabetisch sortierte Liste — anders als im generischen Tab, da eigene
  Zutaten erfahrungsgemäss nur eine Handvoll sind) sowie "+ Neue Zutat
  erfassen" (öffnet `customFoodForm.ts` **inline anstelle der Liste** — es
  gibt für eine neue Zutat ja noch keine Detailansicht). Klick auf eine
  bestehende Zutat ruft `onSelectFood(foodId)` auf (→ Detailansicht,
  gemeinsam mit generischen Zutaten, siehe unten), **kein** inline
  Bearbeiten/Löschen mehr in der Liste selbst.
- `foodDetailView.ts`: gemeinsame Detailansicht generisch **und** eigen
  - Name, Kategorie, Synonyme (falls vorhanden)
  - Nährwerte **pro 100 g** über `calculateNutrition([{ foodId, amountGrams:
    100 }], foodsById)` + `renderNutritionSummary` (liefert Tabelle **und**
    Chart in einem, wie bei Rezept-/Menü-Detail — keine neue
    Chart-Komponente nötig)
  - Ist die Zutat eine eigene (`isOwnCustomFoodId(food.id)`, aus
    `customFoodService.ts`): zusätzlich "Bearbeiten"/"Löschen"-Buttons —
    "Bearbeiten" tauscht die Detailansicht gegen `customFoodForm.ts`,
    nach dem Speichern zurück zur (aktualisierten) Detailansicht;
    "Löschen" nutzt `countFoodUsage`/`buildFoodDeleteConfirmMessage`
    (Instruktion 13) und führt danach zurück zur Liste. Generische
    Einträge/Markenprodukte (Instruktion 12) bleiben ohne diese Buttons.

### 3. Eigene Zutaten von der Profilseite in den neuen Reiter verschieben
- `src/features/profile/profileForm.ts`: Aufruf von `renderCustomFoodsSection`
  + der zugehörige Import entfernt — Profilseite enthält jetzt nur noch
  Profil-Formular + Daten-Backup-Abschnitt (Instruktion 10).
- `src/features/custom-foods/customFoodsSectionView.ts` komplett gelöscht
  (siehe Update-Hinweis oben) — der Ordner `custom-foods/` entfällt damit,
  `customFoodForm.ts` liegt neu unter `src/features/ingredients/`.
- Kein Unterschied für Datenhaltung/Backup: `customFoodService.ts` und die
  `BackupData.customFoods`-Erweiterung (Instruktion 13) bleiben unverändert
  — es ändert sich nur, **wo** und **wie** (Liste + gemeinsame
  Detailansicht statt Liste mit Inline-Formular) die eigenen Zutaten in der
  App verwaltet werden.

### 4. Suchfeld / Abgrenzung generisch vs. eigen im "Zutaten"-Tab
- Im Tab **"Zutaten"** (generisch) werden bewusst **auch** eigene Zutaten
  mitangezeigt, wenn sie zur Suche passen (da `getAllFoods`/
  `searchFoodsByName` sie ohnehin mischt, siehe Instruktion 13) — das ist
  gewünscht, damit man z.B. "Skyr" findet, egal ob generisch oder eigen.
- Im Tab **"Eigene Zutaten"** wird nur `getCustomFoods()` gefiltert
  (`rankFoodsByQuery(getCustomFoods(), query)`), leeres Suchfeld zeigt hier
  sofort die volle (kurze) Liste — anders als im generischen Tab, da eigene
  Zutaten erfahrungsgemäss nur eine Handvoll sind.
- In der generischen Liste lassen sich eigene Zutaten optisch nicht
  gesondert markieren müssen (kein Pflichtteil) — wer sie separat verwalten
  will, wechselt in den Tab "Eigene Zutaten".

### 5. Tests
- Keine neuen Test-Dateien: `src/features/ingredients/*.ts` sind reine
  DOM-Rendering-Views ohne eigene Logik, die über bestehende, bereits
  getestete Services läuft (`foodDatabaseService.mergeFoods`/
  `rankFoodsByQuery`, `customFoodService`, `referenceUsageService`) — genau
  wie `recipeListView.ts`, `menuListView.ts`, `foodPickerControl.ts` etc.
  im Rest der App auch keine eigenen Tests haben (Projekt-Konvention: nur
  reine Logik/Services werden mit `node:test` abgedeckt, keine
  DOM-Views — es gibt auch kein DOM-Test-Setup wie jsdom im Projekt).
- Bestehende Tests für `customFoodService`/`referenceUsageService`/
  `foodDatabaseService` (`mergeFoods`) bleiben unverändert gültig — die
  zugrundeliegende Logik hat sich durch diese Instruktion nicht geändert,
  nur ihre UI-Einbettung.

---

## Was NICHT Teil dieses Auftrags ist
- Keine Mengen-/Portionseingabe in der Zutaten-Detailansicht — Nährwerte
  werden fix **pro 100 g** gezeigt (wie in der Datenbank selbst), keine
  Skalierung wie bei Rezepten/Menüs.
- Keine Bearbeitung/Löschung von generischen Einträgen oder
  Build-Zeit-Markenprodukten (Instruktion 12) — nur `custom-local-`-Einträge
  (Instruktion 13) bleiben editierbar/löschbar.
- Keine Kategorien-Filterung/-Gruppierung/Sortierung nach Nährwerten — nur
  die bestehende Name/Synonym-Suche (`rankFoodsByQuery`), unverändert.
- Keine Änderung an `foodPickerControl.ts` oder an der Zutat-Auswahl in
  Tages-Log/Menü-Builder — die neue Seite ist eine reine Browse-/
  Verwaltungsansicht, kein Ersatz für die bestehende Auswahl-Komponente.
- Kein URL-Routing/Deep-Linking auf einzelne Zutaten (App hat generell
  keinen Router, siehe `main.ts`).
- Keine Änderung an `BackupData`/`customFoodService.ts` (Instruktion 13) —
  nur die UI-Platzierung des "Eigene Zutaten"-Abschnitts ändert sich.
- Kein neuer Chart-Typ — Wiederverwendung von `renderNutritionSummary`
  (Tabelle + Chart in einem), keine eigene Visualisierung für einzelne
  Lebensmittel.

## Nach Abschluss
Bitte zeigen:
- Neue Nav-Reihenfolge: `Profil, Mein Bedarf, Log, Verlauf, Zutaten, Menüs,
  Rezepte`.
- Reiter "Zutaten" öffnen: Umschalter zwischen "Zutaten" und "Eigene
  Zutaten", in beiden je einmal suchen/filtern.
- Ein generisches Lebensmittel anklicken → Detailansicht mit Nährwerttabelle
  **und** Chart, kein Bearbeiten/Löschen möglich.
- Eine eigene Zutat anklicken → gleiche Detailansicht **mit**
  Bearbeiten/Löschen (inkl. der Lösch-Warnung aus Instruktion 13, falls die
  Zutat in einem Menü/Log verwendet wird).
- Profilseite zeigen: kein "Eigene Zutaten"-Abschnitt mehr, nur noch
  Profil-Formular + Daten-Backup.
- `npm test`, `npm run typecheck`, `npm run lint` und `npm run build` grün.
