# Instruktion 13: Eigene Zutaten erfassen (nur lokal) + Daten-Backup

## Kontext
Aufbauend auf:
- `src/data/foodDatabaseService.ts` — lädt/cached die generische
  Nährwertdatenbank (`getAllFoods`, `getFoodById`, `searchFoodsByName`)
- `src/data/models/food.ts` — `FoodItem`, `FoodVitamins`, `FoodMinerals`
- `src/data/localStorageService.ts` — bestehendes Muster für lokal
  gespeicherte Daten (Profil, `requirementOverrides`, `historySettings`),
  jeweils mit einer reinen Parsing-Funktion getrennt vom
  `localStorage`-Zugriff
- `src/features/shared/foodPickerControl.ts` — gemeinsame Zutatensuche,
  genutzt von Menü-Builder (Instruktion 6) und Tages-Log (Instruktion 9)
- `src/features/backup/` — Daten-Backup (Export/Import) auf der Profilseite
  (Instruktion 10)
- `src/features/profile/profileForm.ts` — Profilseite, an die der
  Backup-Abschnitt bereits angehängt ist
- Instruktion 12 (`quellen/eigene-produkte.json`): Markenprodukte, die zur
  Build-Zeit über `npm run convert:food-db` fest in `food-database.json`
  eingemischt werden. Dort ausdrücklich **nicht** Teil des Auftrags: eine
  UI zum Erfassen/Bearbeiten in der App.

Ziel dieser Instruktion: genau diese Lücke schliessen — Zutaten, die weder
in der generischen Datenbank noch als Markenprodukt in Instruktion 12
gepflegt werden (z.B. ein selbstgemachtes Rezept-Grundnährwertprofil, ein
Produkt, das sich nicht lohnt fest ins Repo zu committen), sollen sich
**direkt in der App** erfassen, bearbeiten und löschen lassen — rein lokal
im `localStorage` dieses Geräts, ohne Build-Schritt. Erfasste Zutaten sollen
überall dort auswählbar sein, wo bereits nach Zutaten gesucht wird (Tages-Log,
Menü-Builder, Rezepte), und Teil des bestehenden Daten-Backups sein, damit sie
nicht verloren gehen.

---

## Aufgaben

### 1. Datenhaltung: `src/data/customFoodService.ts`
- Eigener Storage-Key (`nutribalance:customFoods`), Inhalt: JSON-Array von
  `FoodItem`-Objekten — gleiche Struktur wie ein Eintrag der generischen
  Datenbank, damit kein zweites Datenmodell nötig ist.
- Eigener ID-Präfix `custom-local-` (z.B. `custom-local-<uuid>`, per
  `crypto.randomUUID()`) — bewusst **anders** als der `custom-`-Präfix aus
  Instruktion 12, damit sich lokal erfasste Zutaten nicht mit den
  Build-Zeit-Markenprodukten überschneiden können.
- `getCustomFoods()` / `saveCustomFoods(foods)` — Rohzugriff.
- `parseStoredCustomFoods(raw: string | null): FoodItem[]` — reine
  Parsing-Funktion (analog zu `parseStoredProfile`), aber: ein einzelner
  kaputter/manuell editierter Eintrag lässt nur **diesen** Eintrag
  verschwinden, nicht die ganze Liste (anders als bei `parseStoredProfile`,
  wo das ganze Profil verworfen wird — hier sind es unabhängige Listen-
  Elemente).
- `isValidCustomFoodItem(value): value is FoodItem` — grobe
  Struktur-Prüfung (id/name.de/category vorhanden, Makro-Felder Zahl oder
  `null`, vitamins/minerals mit gültigen `{value, unit}`-Einträgen). Wird
  sowohl von `parseStoredCustomFoods` als auch von der Backup-Validierung
  (Punkt 4) verwendet.
- `createCustomFood(input)` / `applyCustomFoodInput(existing, input)` —
  bauen aus den Formulareingaben (Punkt 2) ein vollständiges `FoodItem`;
  alle Vitamine/Mineralstoffe werden auf `{ value: null, unit: … }` gesetzt
  (keine Angabe möglich/nötig bei Hand-Erfassung — nicht raten, nicht 0,
  siehe Instruktion 12).
- `upsertCustomFood(food)` — neue `id` anhängen, bestehende `id` an Ort und
  Stelle ersetzen. `deleteCustomFood(id)` — entfernen.

### 2. UI: Formular + Liste (`src/features/custom-foods/`)
- `customFoodForm.ts`: Formular mit Name (Pflicht), Kategorie (optional,
  Default "Eigene Zutaten"), sowie Energie/Protein/Fett/davon gesättigt/
  Kohlenhydrate/davon Zucker/Ballaststoffe — alle **optional**, leeres Feld
  → `null` (nicht 0). Wasser/Alkohol bewusst nicht im Formular (siehe
  "Was nicht Teil ist").
- `customFoodsSectionView.ts`: Abschnitt "Eigene Zutaten" mit Liste
  bestehender eigener Zutaten (Name + kurze Nährwert-Zusammenfassung pro
  100 g), je Zeile "Bearbeiten"/"Löschen" (Löschen mit
  Bestätigungsdialog), sowie "+ Neue Zutat erfassen" (öffnet das Formular
  inline). Selbstständig re-renderndes Muster wie `profileView.ts`/
  `renderBackupSection` — kein Reload der ganzen Profilseite nötig.
- In `profileForm.ts` einbinden: direkt **vor** dem bestehenden
  Backup-Abschnitt (gleiche Stelle wie dieser — unabhängig davon, ob schon
  ein Profil existiert).

### 3. Einbindung in Suche/Auswahl
`src/data/foodDatabaseService.ts`:
- `mergeFoods(generic: FoodItem[], custom: FoodItem[]): FoodItem[]` als
  reine, exportierte Funktion (testbar ohne `localStorage`) — analog zu
  `mergeCustomProducts` in `scripts/convert-food-db.ts`: gleiche `id`
  ersetzt an Ort und Stelle, neue `id` wird angehängt.
- `getAllFoods()` ruft `mergeFoods(generisch, getCustomFoods())` — generische
  Liste bleibt wie bisher gecacht, `getCustomFoods()` wird bei jedem Aufruf
  frisch aus dem `localStorage` gelesen, damit eine gerade erfasste Zutat
  ohne Reload sofort in Tages-Log/Menü-Builder/Rezepten auswählbar ist.
- `getFoodById`/`searchFoodsByName` nutzen (transitiv über `getAllFoods`)
  automatisch die zusammengeführte Liste — keine Änderung an
  `foodPickerControl.ts` oder den Verbrauchern nötig.

### 4. Daten-Backup erweitern
- `src/features/backup/models/backup.ts`: `BackupData` um
  `customFoods: FoodItem[]` ergänzen; `BACKUP_SCHEMA_VERSION` von `1` auf
  `2` erhöhen — anders als bei `requirementOverrides` in Instruktion 10
  **mit** Versionserhöhung, weil die App inzwischen im Einsatz ist und ein
  bestehendes v1-Backup sonst still ohne eigene Zutaten importiert würde.
- `backupService.ts`: `exportBackup()` liest `getCustomFoods()` mit ein;
  `validateBackupData()` prüft `customFoods` als Array gültiger
  `FoodItem`s (`isValidCustomFoodItem`, siehe Punkt 1); `importBackup()`
  ersetzt die eigenen Zutaten vollständig (`saveCustomFoods()`, kein
  Merge — konsistent mit Menüs/Log-Einträgen).
- `backupSectionView.ts`: Bestätigungstext vor dem Import um "eigene
  Zutaten" ergänzen, da jetzt ebenfalls überschrieben.

### 5. Tests
- `src/data/customFoodService.test.ts`: `createCustomFood` (Präfix, leere
  Vitamine/Mineralstoffe, Default-Kategorie), `applyCustomFoodInput`
  (behält `id`), `upsertCustomFood` (anhängen vs. ersetzen),
  `deleteCustomFood`, `parseStoredCustomFoods` (kaputtes JSON → `[]`,
  einzelner kaputter Eintrag wird übersprungen statt die ganze Liste zu
  verwerfen), `isValidCustomFoodItem` (Pflichtfelder).
- `src/data/foodDatabaseService.test.ts`: `mergeFoods` (unverändert ohne
  eigene Zutaten, Ersetzen bei gleicher `id`, Anhängen bei neuer `id`).
- `src/features/backup/backupService.test.ts`: Export→Import-Roundtrip um
  `customFoods` erweitert; ein v1-Backup (ohne `customFoods`) wird
  abgelehnt statt migriert; ungültige `customFoods` werden abgelehnt.

---

## Was NICHT Teil dieses Auftrags ist
- Keine Erfassung von Vitaminen/Mineralstoffen im Formular — nur Energie
  und Makronährstoffe (Protein/Fett/davon gesättigt/Kohlenhydrate/davon
  Zucker/Ballaststoffe). Wasser/Alkohol ebenfalls nicht (selten relevant
  bei Hand-Erfassung, Datenmodell erlaubt trotzdem `null`).
- Keine Migration zwischen `schemaVersion` 1 und 2 — ein altes Backup ohne
  `customFoods` wird beim Import klar abgelehnt (siehe bestehendes
  "kein Raten unbekannter Formate" aus Instruktion 10), nicht automatisch
  nachgerüstet.
- Keine Prüfung, ob eine gelöschte eigene Zutat noch in bestehenden Menüs/
  Rezepten/Log-Einträgen referenziert wird — Verbraucher zeigen in diesem
  Fall bereits heute "Unbekannte Zutat (…)" bzw. überspringen den Eintrag
  (bestehendes Verhalten bei jeder gelöschten Referenz, siehe
  `menuDetailView.ts`/`recipeDetailView.ts`/`dailyNutritionService.ts`).
- Kein Abgleich/Zusammenführen mit den Build-Zeit-Markenprodukten aus
  Instruktion 12 (`quellen/eigene-produkte.json`) — beide Wege bleiben
  unabhängig nebeneinander bestehen, unterscheidbar am ID-Präfix.
- Keine Kategorien-Filterung/-Gruppierung in der Zutatensuche — eigene
  Zutaten erscheinen wie generische Einträge, nur über Name/Synonym
  auffindbar.
- Kein Sync zwischen Geräten (wie beim generellen Daten-Backup: rein
  lokal, Übertragung nur manuell per Backup-Datei).

## Nach Abschluss
Bitte zeigen:
- Auf der Profilseite eine neue eigene Zutat erfassen (z.B. nur Name +
  Energie, Rest leer lassen), danach in Tages-Log **und** Menü-Builder
  über die Zutatensuche auffindbar und nutzbar zeigen.
- Dieselbe Zutat bearbeiten (Wert ändern) und löschen; nach dem Löschen ist
  sie in der Suche nicht mehr auffindbar.
- Ein Daten-Backup exportieren, die JSON-Datei kurz zeigen (`customFoods`
  mit dem erfassten Eintrag, `schemaVersion: 2`), lokale Daten löschen,
  Backup importieren → eigene Zutat ist wieder da.
- Ein absichtlich manipuliertes Backup mit `schemaVersion: 1` (kein
  `customFoods`-Feld) importieren → klare Fehlermeldung, kein
  teilweiser Import.
- `npm test` grün.
