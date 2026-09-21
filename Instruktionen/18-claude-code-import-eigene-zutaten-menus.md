# Instruktion 18: Selektiver Import eigener Zutaten und Menüs aus einer Backup-Datei

## Kontext

Aufbauend auf:

- `src/features/backup/backupService.ts` (Instruktion 10) — der bestehende
  **volle** Backup-Export/-Import: `exportBackup`/`downloadBackup` erzeugen
  eine JSON-Datei mit `schemaVersion`, `exportedAt`, `profile`,
  `requirementOverrides`, `menus`, `logEntries`, `customFoods`
  (`BACKUP_SCHEMA_VERSION`, aktuell `2`, siehe `models/backup.ts`).
  `parseBackupJson`/`validateBackupData` parsen + prüfen eine solche Datei
  in einem Schritt (falsches JSON, falsche `schemaVersion` oder strukturell
  ungültige Einträge → klare Fehlermeldung, **kein** Raten/Migrieren).
  `importBackup` ersetzt danach **alles** auf einmal (Profil überschreiben,
  `menus`/`logEntries`-Stores komplett leeren + neu befüllen,
  `customFoods` komplett überschreiben) — siehe `backupSectionView.ts`
  (Nutzeroberfläche auf der Profilseite, mit deutlicher Warnung vor dem
  vollständigen Ersetzen).
- `src/data/customFoodService.ts` (Instruktion 13) — `getCustomFoods`/
  `saveCustomFoods` (liest/schreibt die komplette Liste unter
  `localStorage`-Key `nutribalance:customFoods`), `CUSTOM_FOOD_ID_PREFIX`
  (`'custom-local-'`) + `isOwnCustomFoodId(id)` zur Unterscheidung von
  eigenen Zutaten gegenüber der generischen BLV-Datenbank (numerische IDs).
- `src/data/indexedDbService.ts` — `saveMenu(menu)` ist ein Upsert
  (`db.put`, `keyPath: 'id'`), `getAllMenus()` liest den kompletten
  `menus`-Store.
- `src/features/menu-builder/models/menu.ts` — `Menu.ingredients:
RecipeIngredient[]`, jede Zutat referenziert eine `foodId` (entweder eine
  generische BLV-ID oder eine eigene `custom-local-…`-ID).
- `src/features/ingredients/ownFoodsPanel.ts` (Instruktion 14, in dieser
  Session um Namenssuche ergänzt) — Tab "Eigene Zutaten": `renderList()`
  zeigt Such-Feld + `<ul data-list>` + Button "+ Neue Zutat erfassen"
  (`.profile-view__actions`).
- `src/features/menu-builder/menuListView.ts` (in dieser Session um
  Namenssuche/Sortierung ergänzt) — Menü-Liste: `renderList()` mit
  `<ul data-list>` + `.recipe-list__actions` ("Neues Menü erstellen",
  "Zurück").
- `src/features/shared/referenceUsageService.ts` — Präzedenzfall für
  informative, undestruktive Zählungen vor einer riskanten Aktion
  (`buildFoodDeleteConfirmMessage`/`buildMenuDeleteConfirmMessage`), hier
  aber **ohne** Lösch-Charakter — Import fügt nur hinzu, überschreibt nie
  bestehende lokale Daten (siehe Zielsetzung unten).

**Warum IDs kollidieren können:** Eigene Zutaten (`custom-local-<uuid>`)
und Menüs (`crypto.randomUUID()`) werden rein lokal pro Gerät erzeugt.
Bringt eine Person eine fremde Backup-Datei mit (der eigentliche Anwendungs-
fall dieser Instruktion — Zutaten/Menüs von anderen übernehmen), sind
zufällige UUID-Kollisionen zwar extrem unwahrscheinlich, aber ein **echter**
Kollisionsfall ist naheliegend: dieselbe Backup-Datei (oder eine ältere
Version einer bereits einmal importierten Zutat/eines Menüs) wird ein
zweites Mal importiert, während die lokale Kopie inzwischen bearbeitet
wurde — dann existiert lokal bereits eine **andere** Zutat/ein anderes Menü
unter exakt derselben ID. Diese Instruktion muss diesen Fall abfangen, ohne
je unbemerkt lokale Daten zu überschreiben (siehe Punkt 1).

Aktuell gibt es **keinen** Weg, gezielt nur einzelne Zutaten oder Menüs aus
einer fremden Backup-Datei zu übernehmen — nur der volle Restore auf der
Profilseite, der den kompletten lokalen Datenbestand ersetzt. Das eignet
sich nicht zum Austausch einzelner Zutaten/Menüs zwischen zwei Personen
oder Geräten.

Ziel: Je ein **"Importieren"-Button** auf der Zutaten-Seite (Tab "Eigene
Zutaten") und auf der Menü-Liste. Beide lesen dieselbe **bestehende, volle**
Backup-Datei (Instruktion 10, kein neues Dateiformat), zeigen daraus aber
nur die jeweils relevanten Einträge (Zutaten bzw. Menüs) **einzeln nach
Namen anwählbar** an und übernehmen ausschliesslich die ausgewählten
Einträge in den lokalen Bestand — additiv, ohne bestehende Zutaten/Menüs/
Profil/Log-Einträge anzurühren. Referenziert ein importiertes Menü eigene
Zutaten, die lokal fehlen, werden diese **automatisch** aus derselben
Backup-Datei mitgebracht (ohne separate Auswahl), damit das Menü nicht
kaputt/unvollständig ankommt.

---

## Aufgaben

### 1. Merge-Kernlogik (neu: `src/features/backup/partialImportService.ts`)

Reine, ohne Browser-Umgebung testbare Funktionen — kein `localStorage`-/
IndexedDB-Zugriff in dieser Datei (analog zu `validateBackupData` vs.
`importBackup`):

```ts
export interface MergeResult<T extends { id: string }> {
  /** Bestehende Einträge unverändert + neu übernommene (ggf. mit neuer ID) angehängt. */
  items: T[]
  /** Alte → neue ID, nur für Einträge mit echter ID-Kollision + abweichendem Inhalt. */
  idRemap: Map<string, string>
  /** Anzahl tatsächlich neu übernommener Einträge (inkl. umbenannter Kopien). */
  importedCount: number
  /** Anzahl übersprungener Einträge, weil unter derselben ID bereits inhaltlich identisch vorhanden. */
  skippedIdenticalCount: number
}

export function mergeImportedItems<T extends { id: string }>(
  existing: T[],
  incoming: T[],
  generateId: () => string,
): MergeResult<T>
```

Kollisionsregel (**nie** bestehende lokale Daten überschreiben):

- Kein bestehender Eintrag mit dieser `id` → unverändert übernehmen.
- Bestehender Eintrag mit gleicher `id` und **identischem** Inhalt
  (Struktur-Vergleich, nicht nur `id`) → überspringen (kein Duplikat;
  macht wiederholten Import derselben Datei ungefährlich).
- Bestehender Eintrag mit gleicher `id`, aber **abweichendem** Inhalt →
  Kopie mit neuer, über `generateId()` erzeugter ID anlegen, Eintrag
  `idRemap.set(alteId, neueId)`. Gilt genauso für zwei Einträge **innerhalb
  derselben** eingehenden Liste, die zufällig dieselbe ID teilen (die
  Funktion prüft nach jedem Schritt gegen den bereits aufgebauten
  Zwischenstand, nicht nur gegen `existing`).
- `items.slice(existing.length)` ergibt exakt die neu hinzugekommenen
  Einträge (Original-Reihenfolge von `existing` bleibt vorne unverändert)
  — praktisch für Aufrufer, die z.B. nur die neuen Menüs einzeln per
  `saveMenu` in IndexedDB schreiben wollen, statt den ganzen Store zu
  ersetzen (siehe Punkt 4).

Zusätzliche Hilfsfunktionen für Menü-Importe:

```ts
/** IDs eigener Zutaten (isOwnCustomFoodId), die dieses Menü referenziert, aber lokal fehlen. */
export function findMissingCustomFoodIds(menu: Menu, localCustomFoods: FoodItem[]): string[]

export interface ResolvedMenuFoods {
  /** In der Backup-Datei gefundene, lokal fehlende eigene Zutaten (dedupliziert über mehrere Menüs). */
  foods: FoodItem[]
  /** Referenzierte eigene-Zutat-IDs, die weder lokal noch in der Backup-Datei existieren. */
  unresolvedIds: string[]
}

export function resolveReferencedCustomFoods(
  menus: Menu[],
  backupCustomFoods: FoodItem[],
  localCustomFoods: FoodItem[],
): ResolvedMenuFoods

/** Neues Menü-Objekt mit angepassten `ingredients[].foodId` gemäss `idRemap` (nur betroffene Zutaten geändert). */
export function remapMenuIngredients(menu: Menu, idRemap: Map<string, string>): Menu
```

`findMissingCustomFoodIds`/`resolveReferencedCustomFoods` ignorieren
generische BLV-IDs (nicht `isOwnCustomFoodId`) komplett — dafür bleibt das
bestehende "Unbekannte Zutat"-Verhalten (Instruktion 9) unverändert
zuständig, siehe "Was NICHT Teil ist".

### 2. Wiederverwendbare Auswahl-Oberfläche (neu: `src/features/backup/importSelectionView.ts`)

Eine generische, von beiden Importflüssen genutzte Checkbox-Liste (reine
DOM-View, kein eigener State-Store):

```ts
export interface ImportSelectionItem {
  id: string
  label: string
  /** Zweite Zeile pro Eintrag, z.B. Nährwert-Kurzfassung oder Erstellungsdatum + Mitimport-Hinweis. */
  description?: string
}

export interface ImportSelectionOptions {
  container: HTMLElement
  title: string
  items: ImportSelectionItem[]
  /** z.B. "Ausgewählte Zutaten importieren". */
  confirmLabel: string
  onConfirm: (selectedIds: string[]) => void
  onCancel: () => void
}

export function renderImportSelection(options: ImportSelectionOptions): void
```

- Rendert `title`, darunter "Alle auswählen"/"Alle abwählen" (ein
  Checkbox-Link, togglet alle Zeilen), dann `items` sortiert wie vom
  Aufrufer übergeben (Aufrufer sortiert bereits alphabetisch) als Liste im
  `.radio-option`-Stil (Checkbox statt Radio, siehe Punkt 5), je Zeile
  `label` fett + `description` (falls vorhanden) klein/gedämpft darunter.
  Leere `items`-Liste → `<p class="recipe-list__status">Die Backup-Datei
enthält keine eigenen Zutaten/Menüs.</p>` statt einer leeren Liste
  (Aufrufer übergibt den passenden Text nicht — bewusst generisch
  gehalten: Aufrufer kann bei leerer Liste alternativ direkt gar nicht erst
  in den Auswahl-Modus wechseln und stattdessen sofort eine Statusmeldung
  zeigen; welche Variante gewählt wird, liegt am Aufrufer).
- `confirmLabel`-Button (`.button-primary`) deaktiviert, solange nichts
  angewählt ist; "Abbrechen" (`.button-secondary`) ruft `onCancel()`.

### 3. Eigene Zutaten importieren (`src/features/ingredients/ownFoodsPanel.ts`)

- Neuer Button "Zutaten importieren" (`.button-secondary`) neben "+ Neue
  Zutat erfassen", plus verstecktes `<input type="file" accept=".json,
application/json" hidden>` — Datei-Handling analog zu
  `backupSectionView.ts` (Klick öffnet Dateidialog, `file.text()` +
  `parseBackupJson(raw)`).
- Fehlerfall (kaputtes JSON/falsche `schemaVersion`/ungültige Struktur) →
  Statusmeldung (`field-error`) direkt in der Liste, **kein** Moduswechsel.
- Erfolgsfall → neuer Panel-Modus `{ type: 'import'; data: BackupData }`:
  `renderImportSelection` mit `items` aus `data.customFoods` (alphabetisch
  nach `name.de` sortiert), `label: food.name.de`, `description:
summarizeFood(food)` (bestehende Funktion wiederverwenden).
- `onConfirm(selectedIds)`:
  - `selected = data.customFoods.filter(f => selectedIds.includes(f.id))`
  - `merge = mergeImportedItems(getCustomFoods(), selected, () =>
\`${CUSTOM_FOOD_ID_PREFIX}${crypto.randomUUID()}\`)`
  - `saveCustomFoods(merge.items)`
  - zurück zu `{ type: 'list' }`, dabei kurze Statusmeldung (z.B. via
    Parameter an `renderList`) mit `merge.importedCount`/
    `merge.skippedIdenticalCount`, z.B. "2 Zutaten importiert." bzw. "1
    Zutat importiert, 1 bereits identisch vorhanden (übersprungen)."
- `onCancel()` → zurück zu `{ type: 'list' }`, keine Änderung.

### 4. Menüs importieren (`src/features/menu-builder/menuListView.ts`)

- Neuer Button "Menüs importieren" (`.button-secondary`) in
  `.recipe-list__actions`, plus verstecktes File-Input wie in Punkt 3.
- Erfolgreich geparstes Backup → Auswahlliste aus `data.menus`
  (alphabetisch nach `name`): `label: menu.name`, `description:` Datum
  (`formatDate(menu.createdAt)`) plus, falls `findMissingCustomFoodIds
(menu, getCustomFoods())` nicht leer ist, einen Zusatz-Hinweis mit den
  **Namen** der fehlenden Zutaten, sofern in `data.customFoods` auflösbar
  (z.B. "· bringt automatisch mit: Erdnussbutter Hausmarke"), und falls
  einzelne referenzierte IDs auch dort nicht auflösbar sind, zusätzlich
  "· enthält 1 nicht auflösbare Zutat (erscheint als 'Unbekannte
  Zutat')".
- `onConfirm(selectedIds)`:
  - `selectedMenus = data.menus.filter(m => selectedIds.includes(m.id))`
  - `localCustomFoods = getCustomFoods()`
  - `{ foods: neededFoods } = resolveReferencedCustomFoods(selectedMenus,
data.customFoods, localCustomFoods)`
  - `foodMerge = mergeImportedItems(localCustomFoods, neededFoods, () =>
\`${CUSTOM_FOOD_ID_PREFIX}${crypto.randomUUID()}\`)`
  - `saveCustomFoods(foodMerge.items)` (auch wenn `neededFoods` leer ist —
    dann ein No-op, kein Sonderfall nötig)
  - `remappedMenus = selectedMenus.map(m => remapMenuIngredients(m,
foodMerge.idRemap))`
  - `existingMenus = await getAllMenus()`
  - `menuMerge = mergeImportedItems(existingMenus, remappedMenus, () =>
crypto.randomUUID())`
  - nur die **neuen** Menüs einzeln speichern: `for (const menu of
menuMerge.items.slice(existingMenus.length)) await saveMenu(menu)`
    (kein `replaceAllMenus` — das würde bestehende Menüs riskieren, die
    hier nicht Teil des Imports sind)
  - zurück zu `{ type: 'list' }` + `renderList()` neu laden, Statusmeldung
    mit `menuMerge.importedCount`/`menuMerge.skippedIdenticalCount` sowie
    ggf. `foodMerge.importedCount` ("2 Menüs importiert (davon 1 eigene
    Zutat automatisch mitgebracht).").
- `onCancel()` → zurück zur Liste, keine Änderung.

### 5. Styles (`src/styles/main.css`)

Neuer Abschnitt "Import-Auswahl (Instruktion 18)":

- `.import-selection` (Flex-Column, `gap: var(--space-sm)`, analog
  `.profile-view__actions`).
- `.import-selection__item` — Kopie von `.radio-option` (Checkbox statt
  Radio: `align-items: flex-start` statt `center`, da `description`
  mehrzeilig sein kann), `input[type='checkbox']` gleich dimensioniert wie
  `.radio-option input[type='radio']` (1.25rem × 1.25rem).
- `.import-selection__description` (`color: var(--color-text-muted)`,
  `font-size: 0.8125rem`, analog `.custom-food-form__hint`).
- `.import-selection__select-all` (Button-artiger Link, wiederverwendet
  denselben Stil wie `.requirements-table__reset`: kein Rahmen,
  `text-decoration: underline`, `color: var(--color-primary)`).

### 6. Tests (neu: `src/features/backup/partialImportService.test.ts`)

- `mergeImportedItems`: (a) keine Überschneidung → alle übernommen,
  `idRemap` leer; (b) gleiche `id` + identischer Inhalt → übersprungen
  (`skippedIdenticalCount: 1`, `items` unverändert gegenüber `existing`);
  (c) gleiche `id` + abweichender Inhalt → neue ID vergeben (per
  injiziertem, deterministischem `generateId`-Stub), `idRemap` enthält
  `alteId → neueId`, bestehender Eintrag bleibt in `items` unverändert
  erhalten; (d) zwei eingehende Einträge mit identischer `id`
  untereinander (keiner existiert lokal) → zweiter bekommt automatisch
  eine neue ID; (e) `items.slice(existing.length)` liefert exakt die neu
  hinzugekommenen Einträge.
- `findMissingCustomFoodIds`: Menü mit einer lokal fehlenden
  `custom-local-…`-Zutat (→ enthalten), einer lokal vorhandenen (→ nicht
  enthalten) und einer generischen numerischen ID (→ ignoriert).
- `resolveReferencedCustomFoods`: fehlende ID in der Backup-Datei
  auflösbar → landet in `foods`; fehlende ID auch dort nicht vorhanden →
  landet in `unresolvedIds`; zwei Menüs referenzieren dieselbe fehlende ID
  → nur einmal in `foods`.
- `remapMenuIngredients`: nur die im `idRemap` enthaltenen `foodId`s
  ändern sich, alle anderen Zutaten bleiben unverändert; Original-`Menu`-
  Objekt wird nicht mutiert (neues Objekt zurückgegeben).
- Kein neuer Test für `ownFoodsPanel.ts`/`menuListView.ts`/
  `importSelectionView.ts` — reine DOM-Views ohne eigene Tests, analog zur
  bestehenden Projekt-Konvention (siehe Instruktion 17, Punkt 10); die
  komplette fachliche Logik steckt testbar in `partialImportService.ts`.

### 7. README

`README.md`, Abschnitt "Instruktionen (Entwicklungsverlauf)": neue Zeile 18
mit Verweis auf diese Datei ergänzen.

---

## Was NICHT Teil dieses Auftrags ist

- **Kein neues Export-Dateiformat** nur für Zutaten oder Menüs — Import
  liest ausschliesslich die bestehende, volle Backup-Datei (Instruktion
  10). `exportBackup`/`downloadBackup`/`BACKUP_SCHEMA_VERSION` bleiben
  unverändert.
- **Kein Import von Profil, Bedarfs-Anpassungen oder Log-Einträgen** über
  diesen neuen Weg — dafür bleibt ausschliesslich der bestehende volle
  "Daten wiederherstellen"-Fluss auf der Profilseite zuständig. Diese
  Instruktion ergänzt ihn um einen selektiven, additiven Spezialfall,
  ersetzt ihn nicht.
- **Kein Zusammenführen über Namen** — zwei Zutaten/Menüs mit gleichem
  Namen, aber unterschiedlicher `id`, werden als zwei getrennte Einträge
  behandelt (Namen dienen nur der Anzeige in der Auswahlliste). Eine
  "vermutlich dasselbe wie X"-Erkennung über Namensähnlichkeit ist nicht
  Teil dieses Auftrags.
- **Keine Migration/Reparatur generischer BLV-Referenzen**: fehlt eine
  generische Zutat (numerische ID) in einem importierten Menü, bleibt es
  beim bestehenden "Unbekannte Zutat"-Verhalten (Instruktion 9) — nur
  `custom-local-…`-IDs lösen den automatischen Mitimport aus.
- **Kein Bump von `BACKUP_SCHEMA_VERSION`** — es wird ausschliesslich aus
  bereits validen Backup-Dateien gelesen, das Dateiformat selbst ändert
  sich nicht.
- **Kein direktes Teilen zwischen Geräten/Personen** (Cloud-Link, QR-Code
  o.Ä.) — der Austausch läuft weiterhin manuell über eine Datei, wie beim
  bestehenden Backup; diese Instruktion macht nur den **Import** daraus
  selektiv statt alles-oder-nichts.
- **Keine Änderung an `deleteMenu`/`deleteCustomFood`** oder an den
  bestehenden Lösch-Warnungen (`referenceUsageService.ts`) — reine
  Ergänzungsfunktion.

## Nach Abschluss

Bitte zeigen:

- Backup-Datei aus einem Profil mit einer eigenen Zutat "Testmus" (ohne
  Menü) exportieren, in einem **anderen** Profil (ohne "Testmus") über
  "Zutaten importieren" laden, "Testmus" anwählen und importieren → Zutat
  erscheint danach in der eigenen Zutatenliste, bestehende eigene Zutaten
  im Zielprofil bleiben unverändert.
- Im Ursprungsprofil ein Menü bauen, das u.a. "Testmus" enthält, Backup
  erneut exportieren. Im Zielprofil (ohne "Testmus" und ohne dieses Menü)
  über "Menüs importieren" **nur** das Menü anwählen (Zutat nicht separat
  ausgewählt, da im anderen Import-Fluss) → nach dem Import sind sowohl
  Menü als auch "Testmus" vorhanden, das Menü zeigt in der Detailansicht
  korrekte Nährwerte statt "Unbekannte Zutat".
- Denselben Export ein zweites Mal ins Zielprofil importieren (Zutat und
  Menü erneut anwählen) → keine Duplikate, Statusmeldung weist auf
  übersprungene, bereits identische Einträge hin.
- Im Zielprofil "Testmus" manuell bearbeiten (z.B. Energiewert ändern),
  danach die **alte** Backup-Datei erneut importieren und "Testmus"
  anwählen → es entsteht eine separate, neue eigene Zutat mit neuer ID
  (die bearbeitete lokale Zutat bleibt unverändert erhalten); wird
  zusätzlich das zugehörige Menü aus derselben Datei importiert, referen­
  ziert es korrekt die neu importierte Kopie.
- `npm test`, `npm run typecheck`, `npm run lint` und `npm run build`
  grün.
