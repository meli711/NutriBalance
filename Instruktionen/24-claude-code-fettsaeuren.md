# Instruktion 24: Fett aufgeschlüsselt nach Fettsäuren (gesättigt / ungesättigt)

## Kontext
Aufbauend auf:
- `src/data/models/food.ts`: `FoodItem.saturatedFat` (g) ist **bereits** im
  Modell und in `public/data/food-database.json` vorhanden (Instruktion 2), bei
  1203 von 1219 Einträgen (98.7 %). Einfach und mehrfach ungesättigte
  Fettsäuren fehlen im Modell noch.
- `quellen/Schweizer_Nahrwertdatenbank.xlsx`, Sheet "Generische Lebensmittel":
  - Spalte 17: "Fettsäuren, gesättigt (g)" (bereits übernommen)
  - Spalte 20: "Fettsäuren, einfach ungesättigt (g)", Wert bei 1199 von 1216
    generischen Einträgen (98.6 %)
  - Spalte 23: "Fettsäuren, mehrfach ungesättigt (g)", Wert bei 1201 von 1216
    (98.8 %)
- `scripts/convert-food-db.ts`: `COL`, `toFoodItem`.
- `src/features/recipes/nutritionCalculator.ts`: `NUTRIENT_DEFINITIONS`
  (10 Nährstoffe seit Instruktion 23).
- `src/features/nutrition-summary/nutritionSummaryView.ts`: die gemeinsame
  Nährwerttabelle für Zutat, Rezept, Menü, Menü-Builder und Tages-Log.
- `src/features/history/historyView.ts` und `parseStoredHistorySettings`
  (`localStorageService.ts`): Die Verlauf-Chips und die gültigen IDs entstehen
  aus `NUTRIENT_LABELS`.
- `quellen/dge-referenzwerte-fett-essenzielle-fettsaeuren.html`: Die DGE
  empfiehlt nur qualitativ, weniger gesättigte und mehr ungesättigte
  Fettsäuren aufzunehmen. Einen Zahlenwert gibt es nur für Gesamtfett
  (30 % der Energie) und für die essenziellen Fettsäuren.

Ziel: In der Nährwerttabelle wird das Fett aufgeschlüsselt:
```
Fett                                  12,0 g   …
  davon gesättigte Fettsäuren          4,1 g   –
  davon einfach ungesättigte Fettsäuren 5,2 g  –
  davon mehrfach ungesättigte Fettsäuren 2,0 g –
```
Das ist **reine Information** ohne Bedarfsvergleich: kein Referenzwert, kein
Radar-Chart, keine Profil-Zeile und keine Verlauf-Chips. Einen Bedarf ohne
Quelle zu erfinden, wäre für die schriftliche Arbeit nicht haltbar.

**Wichtig (Abwärtskompatibilität, nicht verhandelbar):** Wie bei Instruktion 23
müssen alle bestehenden Daten unverändert weiter funktionieren: Profil,
Bedarfs-Anpassungen, Verlauf-Einstellungen, eigene Zutaten, Rezepte, Menüs,
Tages-Log und bestehende Backup-Dateien (vollständig und partiell).
- **Kein** Bump von `BACKUP_SCHEMA_VERSION` / `DB_VERSION`, keine Migration.
- Die neuen Felder im `FoodItem`-Modell sind **optional**
  (`monounsaturatedFat?: number | null`). Bestehende eigene Zutaten und
  Backups haben sie nicht. Fehlt ein Feld, gilt das als "kein Wert"
  (`incomplete: true`, Stern), nie als Absturz.
- Beim Neuerzeugen von `food-database.json` dürfen sich **keine IDs und keine
  bestehenden Werte** ändern. Menüs und Tages-Log verweisen über `foodId` auf
  die Datenbank.

---

## Aufgaben

### 0. Ausgangslage prüfen
- Direkt auf `main` arbeiten (ausdrücklicher Wunsch, kein Feature-Branch).
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` laufen
  lassen und das Ergebnis notieren.
- `npm run convert:food-db` **vor** jeder Änderung laufen lassen und prüfen,
  dass `public/data/food-database.json` danach unverändert ist (`git diff`).
  Sonst ist die Ausgangslage nicht reproduzierbar: **anhalten und nachfragen**.

### 1. Datenmodell und Konvertierung
- `food.ts`: nach `saturatedFat` die optionalen Felder
  `monounsaturatedFat?: number | null` und `polyunsaturatedFat?: number | null`
  (g pro 100 g) ergänzen und dokumentieren, warum sie optional sind.
- `convert-food-db.ts`: `COL.monounsaturatedFat = 20`,
  `COL.polyunsaturatedFat = 23` (mit Spaltentitel als Kommentar) und in
  `toFoodItem` direkt nach `saturatedFat` übernehmen.
- `npm run convert:food-db` ausführen. Mit einem Skript prüfen, dass jeder
  Eintrag der neuen Datei, ohne die zwei neuen Felder, **identisch** mit dem
  alten Eintrag an derselben Position ist (gleiche Anzahl, gleiche IDs, gleiche
  Werte). Ergebnis im Abschlussbericht nennen.
- `customFoodService.ts` und das Formular für eigene Zutaten bleiben
  unverändert (keine neuen Eingabefelder).

### 2. Berechnung
In `NUTRIENT_DEFINITIONS` drei Einträge **am Ende** anhängen (Reihenfolge der
bestehenden 10 nicht ändern):
- `saturatedFat` (g): `food.saturatedFat ?? null`
- `monounsaturatedFat` (g): `food.monounsaturatedFat ?? null`
- `polyunsaturatedFat` (g): `food.polyunsaturatedFat ?? null`

Kompatibilitäts-Kommentar ergänzen: Für diese drei IDs gibt es bewusst keinen
Referenzwert.

### 3. Labels und Unter-Nährstoffe
In `src/utils/nutrientLabels.ts`:
- `NUTRIENT_LABELS` um die drei IDs ergänzen ("gesättigte Fettsäuren",
  "einfach ungesättigte Fettsäuren", "mehrfach ungesättigte Fettsäuren").
- Eine Zuordnung `SUB_NUTRIENT_PARENT` (Unter-Nährstoff → Oberbegriff, hier
  alle drei → `fat`).
- Eine reine Funktion, die `NutrientValues` für die Tabelle so sortiert, dass
  Unter-Nährstoffe direkt nach ihrem Oberbegriff stehen (sonst unveränderte
  Reihenfolge). Unter-Nährstoffe ohne Oberbegriff in der Liste kommen ans Ende.
- `HISTORY_NUTRIENT_IDS`: alle IDs aus `NUTRIENT_LABELS` ohne Unter-Nährstoffe.

### 4. Anzeige
- `nutritionSummaryView.ts`: die Sortierfunktion nutzen. Unter-Nährstoffe als
  "davon …" mit Einrückung (eigene CSS-Klasse) darstellen. Die Spalte
  "% Tagesbedarf" zeigt wie gewohnt "–".
- Verlauf: Chips aus `HISTORY_NUTRIENT_IDS` statt aus `NUTRIENT_LABELS`.
  `parseStoredHistorySettings` filtert ebenfalls auf `HISTORY_NUTRIENT_IDS`.
- Radar-Chart (`CORE_NUTRIENT_IDS`), Profil und Referenzwerte bleiben
  unverändert.

### 5. Tests
Bestehende Tests nicht abschwächen oder löschen. Neu bzw. erweitert:
- `nutritionCalculator.test.ts`: Die drei Fettsäuren werden korrekt summiert.
  Fehlende Felder (z.B. eigene Zutat) ergeben `incomplete: true` ohne Absturz.
  Die bestehenden 10 Nährstoffe bleiben unverändert.
- `nutrientLabels.test.ts` (neu): Sortierung (Unter-Nährstoffe direkt nach
  `fat`, Rest unverändert, ohne `fat` am Ende) und `HISTORY_NUTRIENT_IDS`
  ohne Unter-Nährstoffe.
- `dailyRequirementPercentage.test.ts`: Für die drei IDs gibt es `null`
  (kein Vergleich).
- `localStorageService.test.ts`: Alte Verlauf-Einstellungen bleiben
  unverändert. Fettsäure-IDs werden herausgefiltert.
- `backupService.test.ts`: Das Backup-Fixture aus Instruktion 23 bleibt
  importierbar. Die eigene Zutat daraus (ohne neue Felder) ergibt für die
  ungesättigten Fettsäuren `incomplete: true`.
- `customFoodService.test.ts`: Eine eigene Zutat ohne die neuen Felder ist
  weiterhin gültig.

### 6. Dokumentation
- `README.md`: Liste der ausgewerteten Nährstoffe und Instruktionstabelle
  ergänzen.

---

## Was NICHT Teil dieses Auftrags ist
- Keine Referenzwerte, keine "% Tagesbedarf" und keine Chart-/Verlauf-Anzeige
  für die Fettsäuren.
- Keine neuen Eingabefelder für eigene Zutaten.
- Keine Ergänzung von `quellen/eigene-produkte.json`. Die Einträge zeigen
  dafür den Stern.
- Kein Omega-3 / keine einzelnen Fettsäuren (Linolsäure, EPA, DHA).
- Kein Bump von `BACKUP_SCHEMA_VERSION` / `DB_VERSION`, keine Migration.

## Nach Abschluss
1. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`: alles
   grün. Anzahl Tests vorher/nachher nennen.
2. Im Browser prüfen: Zutat (z.B. Olivenöl, Butter), Rezept, Menü, Tages-Log
   zeigen die "davon"-Zeilen unter Fett. Der Verlauf zeigt keine neuen Chips.
   Bestehende Daten und Backup-Import funktionieren. Die Konsole zeigt keine
   Fehler.
3. Commit auf `main` mit Liste aller geänderten Dateien.
