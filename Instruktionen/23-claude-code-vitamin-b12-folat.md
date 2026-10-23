# Instruktion 23: Vitamin B12 und Folat als ausgewertete Nährstoffe

## Kontext
Aufbauend auf:
- `src/data/models/food.ts` — `FoodItem.vitamins.b12Cobalamin` (µg) und
  `FoodItem.vitamins.folate` (µg) sind **bereits** im Modell und in
  `public/data/food-database.json` vorhanden (Instruktion 2). Datenlage in der
  aktuellen Datenbank (1219 Einträge): B12 bei 1189 (97.5 %), Folat bei 1176
  (96.5 %) mit Wert — also besser als Vitamin C (90.1 %). Die Datenbank und
  `scripts/convert-food-db.ts` müssen deshalb **nicht** angepasst werden.
- `src/features/recipes/nutritionCalculator.ts` — `NUTRIENT_DEFINITIONS`:
  bisher 8 Nährstoffe (`energy`, `protein`, `fat`, `carbohydrates`, `fiber`,
  `calcium`, `iron`, `vitaminC`).
- `src/features/nutrient-requirements/data/referenceValues.ts` —
  `REFERENCE_VALUES` (D-A-CH, DGE 3. Auflage 2025, Abruf 22.08.2026), Muster
  `calciumForAgeGroup`/`vitaminCForAgeGroup` + `*_SOURCE`-Konstanten.
- `src/utils/nutrientLabels.ts` — `NUTRIENT_LABELS`/`UNIT_LABELS`. `UNIT_LABELS`
  kennt **noch kein** `µg`.
- `src/features/charts/nutrientComparisonChart.ts` — `CORE_NUTRIENT_IDS`
  inkl. Auswahlbegründung im Kommentar.
- `src/features/recipes/dailyRequirementPercentage.ts` — Vergleich Aufnahme vs.
  Bedarf über `nutrientId` + `unit`.
- `src/data/localStorageService.ts` — `parseStoredHistorySettings` filtert
  Nährstoff-IDs, die nicht in `NUTRIENT_LABELS` stehen; `RequirementOverrides`
  ist ein offenes `Record<string, number>`.
- `src/features/history/historyView.ts` — die Auswahl-Chips im Verlauf
  entstehen aus `Object.keys(NUTRIENT_LABELS)`.

Ziel: Vitamin B12 und Folat werden überall dort berechnet und angezeigt, wo
heute Calcium, Eisen und Vitamin C erscheinen: Nährwerttabelle (Zutat, Rezept,
Menü, Menü-Builder, Tagessumme), "Bedarf vs. Aufnahme"-Chart, Profil
(Bedarfsübersicht), Verlauf.

**Wichtig (Abwärtskompatibilität, nicht verhandelbar):** Die App läuft bereits
produktiv mit echten Daten im `localStorage` und in der IndexedDB. Nach dieser
Instruktion müssen **alle** bestehenden Daten unverändert weiter funktionieren:
- Profil, Bedarfs-Anpassungen (`requirementOverrides`), Verlauf-Einstellungen,
  eigene Zutaten (`nutribalance:customFoods`), Rezepte, Menüs, Tages-Log.
- Bestehende **Backup-Dateien** (vollständiger und partieller Import) müssen
  weiterhin ohne Fehler importierbar sein.
- **Kein** Bump von `BACKUP_SCHEMA_VERSION` und **kein** Bump von `DB_VERSION`,
  keine Migration. Das ist möglich, weil Nährwerte nirgends gespeichert,
  sondern immer zur Laufzeit aus der Lebensmitteldatenbank berechnet werden.
  Prüfe das zu Beginn (siehe Punkt 0). Falls du doch eine Stelle findest, an
  der berechnete `NutrientValues` persistiert werden: **anhalten und
  nachfragen**, nicht eigenmächtig migrieren.
- Eigene Zutaten haben `b12Cobalamin`/`folate` bereits als
  `{ value: null, unit: 'µg' }` (siehe `customFoodService.ts`). Sie gelten
  damit wie bei Calcium/Eisen/Vitamin C als "kein Wert" → `incomplete: true`
  (Stern in der Tabelle). Das ist gewolltes, bestehendes Verhalten, kein Fehler.

---

## Aufgaben

### 0. Ausgangslage prüfen (vor jeder Änderung)
- Neuen Branch anlegen: `feature/vitamin-b12-folat`. Nicht auf `main` arbeiten.
- `npm test`, `npm run typecheck`, `npm run lint` und `npm run build` laufen
  lassen und das Ergebnis notieren (Stand vor der Änderung: 111 Tests grün).
- Per Suche bestätigen, dass `NutrientValues`/`NutrientAmount` nirgends in
  `localStorage`, IndexedDB oder in Backups geschrieben werden (z.B. in
  `historyNutritionService.ts`, `dailyNutritionService.ts`, `backupService.ts`,
  `menuExportService.ts`). Kurz berichten, was du gefunden hast.

### 1. Referenzwerte (D-A-CH)
In `referenceValues.ts` zwei neue Funktionen nach dem bestehenden Muster
(`vitaminB12ForAgeGroup`, `folateForAgeGroup`) und je eine `*_SOURCE`-Konstante
ergänzen, dann in `REFERENCE_VALUES` für alle `AGE_GROUPS` × `GENDERS`
aufnehmen:

| Nährstoff   | `nutrientId` | Einheit | `referenceType`    | Wert (15 bis 65+, m/w) |
| ----------- | ------------ | ------- | ------------------ | ---------------------- |
| Vitamin B12 | `vitaminB12` | `µg`    | `schaetzwert`      | 4.0                    |
| Folat       | `folate`     | `µg`    | `empfohleneZufuhr` | 300                    |

Quellen:
- `https://www.dge.de/wissenschaft/referenzwerte/vitamin-b12/`
- `https://www.dge.de/wissenschaft/referenzwerte/folat/`

**Werte vor dem Eintragen gegen die DGE-Seiten bzw. die lokalen Snapshots in
`quellen/dge-referenzwerte-*.html` prüfen.** Weichen sie ab (andere Zahl,
andere Kategorie, Unterschied nach Alter oder Geschlecht), gilt die Quelle.
Melde die Abweichung im Abschlussbericht. Schwangerschaft und Stillzeit werden
wie bei den bestehenden Nährstoffen nicht abgebildet. Das Abrufdatum in der
`*_SOURCE`-Konstante ist das Datum, an dem du die Quelle geprüft hast.

Kommentar bei Folat (für die schriftliche Arbeit): Die DGE gibt den Wert in
**Folat-Äquivalenten** an. Die BLV-Datenbank liefert "Folat" in µg ohne
Umrechnung von synthetischer Folsäure. Bei angereicherten Lebensmitteln kann
der Vergleich deshalb leicht abweichen. Das ist eine bewusste Vereinfachung.

Den Kopfkommentar der Datei anpassen ("drei Mikronährstoffe" → fünf, mit kurzer
Begründung für B12/Folat: fachlich zentral, gute Datenlage, siehe Kontext).

### 2. Berechnung
In `nutritionCalculator.ts` zwei Einträge **am Ende** von
`NUTRIENT_DEFINITIONS` anhängen (Reihenfolge der bestehenden Einträge nicht
ändern):
```ts
{ nutrientId: 'vitaminB12', unit: 'µg', getPer100g: (food) => food.vitamins.b12Cobalamin.value },
{ nutrientId: 'folate', unit: 'µg', getPer100g: (food) => food.vitamins.folate.value },
```
Den Kompatibilitäts-Kommentar oberhalb von `NUTRIENT_DEFINITIONS` um die beiden
IDs und die Einheit µg ergänzen.

**Defensiv lesen:** Falls `food.vitamins` oder das einzelne Feld bei einem
Eintrag fehlt (z.B. eine sehr alte eigene Zutat oder ein Fremd-Import), darf
das **nicht** zu einem Absturz führen. Es soll als `null` gelten, also
`incomplete: true`. Mit optionalem Chaining absichern, z.B.
`food.vitamins?.b12Cobalamin?.value ?? null`. Prüfe, ob
`isValidCustomFoodItem` (`customFoodService.ts`) solche Einträge überhaupt
durchlässt. Falls nicht, reicht die Absicherung trotzdem als Schutz und
schadet nicht. Die bestehenden Definitionen bitte **nicht** anfassen.

### 3. Labels
`src/utils/nutrientLabels.ts`:
- `NUTRIENT_LABELS`: `vitaminB12: 'Vitamin B12'`, `folate: 'Folat'` — am Ende
  anhängen (die Reihenfolge bestimmt die Chips im Verlauf).
- `UNIT_LABELS`: `µg: 'µg'` ergänzen.

Achtung Zeichen: überall dasselbe `µ` verwenden wie in `food.ts` und
`customFoodService.ts` (U+00B5 MICRO SIGN, nicht U+03BC griechisches My),
sonst schlägt der Einheitenvergleich in `dailyRequirementPercentage.ts` still
fehl. Mit einem Test absichern (Punkt 6).

### 4. Chart
`CORE_NUTRIENT_IDS` in `nutrientComparisonChart.ts` um `'vitaminB12'` und
`'folate'` erweitern und die Auswahlbegründung im Kommentar ergänzen. Danach
das Radar-Chart im Browser ansehen: Mit 9 Achsen müssen alle Beschriftungen
lesbar bleiben, auch bei schmaler Breite (iPhone). Falls nicht, kurz melden
statt das Layout umzubauen.

### 5. Prüfen, ob es noch weitere Stellen gibt
Nach Stellen suchen, die die Nährstoffe fest aufzählen (z.B. `'vitaminC'`,
`'iron'`, Arrays mit Nährstoff-IDs, CSV-/Export-Spalten in
`menuExportService.ts`, Profil-Anzeige in `profileView.ts`, Bedarfs-
Anpassungen in `profileForm.ts`), und B12/Folat dort ebenfalls ergänzen, wo
es sinnvoll ist. Jede zusätzliche Stelle im Abschlussbericht aufführen.

### 6. Tests
Bestehende Tests nicht abschwächen oder löschen. Neu bzw. erweitert:
- `nutritionCalculator.test.ts`: B12 und Folat werden korrekt summiert. Ein
  Lebensmittel mit `value: null` ergibt `incomplete: true`. Ein Lebensmittel
  **ohne** `vitamins`-Objekt führt zu keinem Absturz und ergibt
  `incomplete: true`. Die bestehenden 8 Nährstoffe liefern unverändert
  dieselben Werte.
- `requirementService.test.ts`: Für jede Altersgruppe × Geschlecht gibt es
  genau einen Eintrag für `vitaminB12` und `folate` mit Einheit `µg`.
- `dailyRequirementPercentage.test.ts`: z.B. 2 µg B12 bei Bedarf 4 µg → 50 %;
  sicherstellen, dass die Einheit aus Berechnung und Referenzwert identisch ist
  (gleiches µ-Zeichen).
- `localStorageService.test.ts`:
  - Alte Verlauf-Einstellungen (`{ nutrientIds: ['protein','iron'], period: 'week' }`)
    werden unverändert gelesen.
  - Neue Einstellungen mit `'vitaminB12'` werden akzeptiert.
  - Alte `requirementOverrides` ohne B12/Folat bleiben gültig.
- `backupService.test.ts` / `partialImportService.test.ts`: Ein Backup-Fixture
  im **heutigen** Format (ohne B12/Folat in Overrides oder Einstellungen) bleibt
  importierbar. Ein neues Backup mit Override für `folate` übersteht den
  Roundtrip.

### 7. Dokumentation
- `README.md`: Die Liste der ausgewerteten Nährstoffe (falls vorhanden)
  ergänzen.
- Keine weiteren neuen Markdown-Dateien anlegen.

---

## Was NICHT Teil dieses Auftrags ist
- **Keine** Änderung an `public/data/food-database.json` oder
  `scripts/convert-food-db.ts`, die Daten sind schon vorhanden.
- **Keine** neuen Eingabefelder für B12/Folat im Formular für eigene Zutaten
  (`customFoodForm.ts`). Kann eine eigene Folge-Instruktion werden.
- **Kein** Bump von `BACKUP_SCHEMA_VERSION` / `DB_VERSION`, keine Migration,
  keine Änderung an gespeicherten Datenstrukturen.
- Die `DEFAULT_HISTORY_SETTINGS` (`['protein']`) bleiben unverändert.
- Keine weiteren Nährstoffe (Omega-3, Vitamin B6, Vitamin D usw.).
- Keine Abbildung von Schwangerschaft/Stillzeit.
- Kein Umbau von Chart-Layout oder Tabellen-Design.

## Nach Abschluss
1. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`: alles
   grün. Anzahl Tests vorher/nachher nennen.
2. `npm run dev` starten und bitte zeigen bzw. beschreiben:
   - Eine Zutat aus der Datenbank (z.B. Rindsleber oder Spinat): Tabelle zeigt
     Vitamin B12 und Folat in µg mit "% Tagesbedarf"; beide erscheinen im Chart.
   - Ein **bestehendes** Rezept, Menü und der Tages-Log von gestern laden ohne
     Fehler und zeigen die beiden neuen Zeilen.
   - Profil: Bedarfsübersicht zeigt B12 (Schätzwert 4 µg) und Folat (300 µg).
   - Verlauf: Neue Chips "Vitamin B12" und "Folat". Die vorher gewählten
     Nährstoffe sind noch ausgewählt.
   - Vor der Änderung ein Backup exportieren, danach wieder importieren:
     funktioniert ohne Fehler.
   - Browser-Konsole: keine Fehler.
3. Commit auf `feature/vitamin-b12-folat` (nicht auf `main`), Liste aller
   geänderten Dateien und allfälliger Abweichungen von den Referenzwerten.
