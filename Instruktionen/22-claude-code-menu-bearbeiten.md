# Instruktion 22: Eigene Menüs bearbeiten

## Kontext

Aufbauend auf:

- `src/features/menu-builder/menuBuilderView.ts` — `renderMenuBuilderView`,
  bisher **ausschliesslich** zum Neu-Erstellen: Name/Beschreibung/
  Kategorie-Dropdown (Instruktion 21) + Zutatenliste über
  `foodPickerControl.ts`, Live-Nährwert-Vorschau, `saveMenu(menu)` mit
  neu generierter `id`/`createdAt` beim Speichern.
- `src/features/menu-builder/menuDetailView.ts` — Detailansicht eines
  Menüs: Name, Erstelldatum, Beschreibung, Zutatentabelle,
  Nährwert-Zusammenfassung, Buttons "Als Rezept exportieren"/"Zurück zur
  Menü-Liste"/"Menü löschen" (`.profile-view__actions`). Lädt das `Menu`
  bereits vollständig (`getMenuById`) sowie alle referenzierten `FoodItem`s
  (`foodsById`).
- `src/features/ingredients/foodDetailView.ts` — **Präzedenzfall fürs
  Bearbeiten**: `renderEdit(current)` ersetzt innerhalb desselben
  `container` die Detailansicht durch `renderCustomFoodForm({
existingFood: current, onSave, onCancel })`; nach Speichern/Abbrechen
  wird wieder `renderView(...)` aufgerufen — **keine** eigene Route in
  `main.ts`, das Bearbeiten passiert vollständig innerhalb der
  Detailansicht.
- `src/app/main.ts` — `showMenuDetail`/`showMenuBuilder` sind bewusst
  getrennte Routen (anders als bei `foodDetailView.ts`); für diese
  Instruktion reicht das unverändert, siehe Punkt 2.
- `src/data/indexedDbService.ts` — `saveMenu(menu)` ist ein Upsert
  (`db.put`, `keyPath: 'id'`) — ein Speichern mit **derselben** `id`
  überschreibt das bestehende Menü an Ort und Stelle, bestehende
  Tages-Log-Einträge (`MenuLogEntry.menuId`) zeigen danach automatisch auf
  die aktualisierte Version (kein Nachziehen nötig, aber auch keine
  Bestätigung/Warnung dafür vorgesehen — siehe "Was NICHT Teil ist").

Ziel: In der Menü-Detailansicht gibt es einen neuen "Bearbeiten"-Button.
Er öffnet **dasselbe** Formular wie beim Neu-Erstellen
(`renderMenuBuilderView`), vorausgefüllt mit Name/Beschreibung/Kategorie/
Zutaten des bestehenden Menüs. Beim Speichern wird das Menü unter
**derselben `id`** aktualisiert (keine Kopie), beim Abbrechen kehrt man
unverändert zur Detailansicht zurück — architektonisch analog zu
`foodDetailView.ts`s Bearbeiten-Fluss, ganz ohne neue Route in `main.ts`.

---

## Aufgaben

### 1. `menuBuilderView.ts`: Bearbeiten-Modus ergänzen

- `MenuBuilderViewOptions` um `existingMenu?: Menu` erweitern.
- `renderMenuBuilderView` wird `async` (`Promise<void>`), da die
  Zutatennamen bestehender Zutaten erst nachgeladen werden müssen
  (`getFoodById`, wie in `menuDetailView.ts`/`recipeDetailView.ts`):
  - Ist `existingMenu` gesetzt: zuerst kurz `<p class="recipe-list__status">Lade Menü…</p>`
    zeigen, dann `Promise.all(existingMenu.ingredients.map(ing =>
getFoodById(ing.foodId)))` auflösen und daraus die initiale
    `ingredients`/`foodsById`-Befüllung aufbauen — fehlt ein `FoodItem`
    (gelöschte eigene Zutat o.Ä.), `foodName: 'Unbekannte Zutat'`
    verwenden (kein Absturz, Zeile bleibt entfernbar wie jede andere).
- Formular-Markup: Überschrift `existingMenu ? 'Menü bearbeiten' : 'Neues
Menü erstellen'`; `#menu-name` bekommt `value="${existingMenu?.name ??
''}"` (Platzhalter bleibt wie bisher der generierte Default-Name);
  `#menu-description` bekommt `existingMenu?.description ?? ''` als
  Inhalt; im Kategorie-`<select>` die passende `<option>` (bzw. "– keine
  Angabe –") mit `selected` markieren.
- Speichern-Handler:
  ```ts
  const menu: Menu = {
    id: existingMenu?.id ?? crypto.randomUUID(),
    name: nameInput.value.trim() || formatDefaultMenuName(),
    description: descriptionInput.value.trim(),
    createdAt: existingMenu?.createdAt ?? new Date().toISOString(),
    ...(category && isMealCategory(category) ? { category } : {}),
    ingredients: ingredients.map(({ foodId, amountGrams }) => ({ foodId, amountGrams })),
  }
  ```
  (`createdAt` bleibt beim Bearbeiten unverändert — es gibt kein
  separates "zuletzt geändert"-Feld und keine Instruktion, eines
  einzuführen.)

### 2. `menuDetailView.ts`: Einstieg + In-Place-Bearbeiten

- Neuer Button "Bearbeiten" (`.button-secondary`) in
  `.profile-view__actions`, zwischen "Als Rezept exportieren" und "Zurück
  zur Menü-Liste".
- Neue lokale Funktion `renderEdit(menu: Menu): void` (analog
  `foodDetailView.ts#renderEdit`): ruft `renderMenuBuilderView({
container, profile, existingMenu: menu, onSaved: () =>
void renderMenuDetailView(options), onCancel: () =>
void renderMenuDetailView(options) })` auf — beide Fälle laden die
  Detailansicht über `renderMenuDetailView(options)` **neu** (statt einen
  in-memory-Zustand weiterzureichen), damit nach dem Speichern garantiert
  die tatsächlich persistierte Version angezeigt wird.
- `data-action="edit"`-Klick-Handler ruft `renderEdit(menu)` auf
  (`destroyActiveSummary()` vorher, analog zu den bestehenden
  Handlern in dieser Datei).
- **Keine Änderung an `main.ts`** — das Bearbeiten läuft komplett
  innerhalb der bereits gerouteten Detailansicht.

### 3. Tests

- Keine neuen Tests nötig: `menuBuilderView.ts`/`menuDetailView.ts` sind
  reine DOM-Views ohne eigene Tests (bestehende Projekt-Konvention, siehe
  Instruktion 17, Punkt 10); `saveMenu` (Upsert-Verhalten) ist bereits in
  `indexedDbService.test.ts` abgedeckt.

---

## Was NICHT Teil dieses Auftrags ist

- **Keine Warnung/Bestätigung** beim Bearbeiten eines Menüs, das bereits
  in Log-Einträgen verwendet wird (anders als beim Löschen,
  `referenceUsageService.ts`) — Bearbeiten ändert die referenzierte
  Version rückwirkend für alle Tage, an denen das Menü geloggt wurde; das
  ist ein bewusst in Kauf genommenes, bereits bestehendes Verhalten (exakt
  dieselbe Charakteristik gilt schon heute fürs Bearbeiten eigener
  Zutaten, `foodDetailView.ts`, ohne eigene Warnung).
- **Kein separates "zuletzt geändert"-Datum** — `createdAt` bleibt beim
  Bearbeiten unverändert, es wird kein `updatedAt`-Feld eingeführt.
- **Keine neue Route in `main.ts`** — das Bearbeiten läuft als
  In-Place-Moduswechsel innerhalb `menuDetailView.ts`, analog zu
  `foodDetailView.ts`.
- **Keine Änderung an `menuListView.ts`/`menuBuilderView.ts`s
  Aufrufstelle in `main.ts`** (`showMenuBuilder` bleibt ausschliesslich
  für "Neues Menü erstellen" zuständig, ruft `renderMenuBuilderView` ohne
  `existingMenu` auf).

## Nach Abschluss

Bitte zeigen:

- Ein bestehendes Menü öffnen, "Bearbeiten" klicken → Formular zeigt
  Name/Beschreibung/Kategorie/Zutaten vorausgefüllt.
- Name ändern, eine Zutat entfernen, eine neue hinzufügen, speichern →
  zurück in der Detailansicht mit den neuen Werten; die Menü-Liste zeigt
  danach ebenfalls den neuen Namen/das ggf. geänderte Icon, ohne dass ein
  zweiter Eintrag entstanden ist.
- "Bearbeiten" öffnen und stattdessen "Abbrechen" klicken → Menü bleibt
  unverändert.
- Ein Menü bearbeiten, das an einem Tag im Tages-Log geloggt ist → dieser
  Tag zeigt danach die aktualisierten Zutaten/Nährwerte (bewusst
  rückwirkend, siehe "Was NICHT Teil ist").
- `npm test`, `npm run typecheck`, `npm run lint` und `npm run build`
  grün.
