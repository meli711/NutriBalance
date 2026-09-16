# Instruktion 15: Faktor pro Log-Eintrag (Zutat/Rezept/Menü)

## Kontext
Aufbauend auf:
- `src/features/daily-log/models/logEntry.ts` — `LogEntry` (Union
  `FoodLogEntry` / `RecipeLogEntry` / `MenuLogEntry`), bisher **kein**
  Multiplikator für `menu` (bewusste Entscheidung aus Instruktion 9, wird
  mit dieser Instruktion aufgehoben)
- `src/data/indexedDbService.ts` — `logEntries`-Object-Store (`by-date`-
  Index), `addLogEntry` (Instruktion 9) ist bereits ein `db.put` und damit
  ein Upsert (überschreibt einen bestehenden Eintrag mit gleicher `id`)
- `src/features/daily-log/dailyNutritionService.ts` —
  `calculateEntryNutrition` (Nährwerte **eines** Log-Eintrags),
  `sumDailyNutrition`/`sumNutrientValues` (Tages-Summe)
- `src/features/daily-log/dailyLogView.ts` — `resolveEntry` (Label pro
  Eintrag), Eintrags-Liste mit ✕-Entfernen-Button
  (`.menu-builder__ingredient-row`, `data-remove-entry-id`)
- `src/features/daily-log/addLogEntryView.ts` — bisher inkl. `window.prompt`
  für die Portionenabfrage bei Rezepten (`"Wie viele Portionen hast du
  gegessen?"`); dieses Popup wird mit dieser Instruktion entfernt (siehe
  Punkt 4) — Rezept-Einträge werden künftig wie Menü-Einträge direkt mit
  einem Klick hinzugefügt, Portionen/Faktor werden danach im Log gesetzt
- `src/features/backup/backupService.ts` — `isValidLogEntry` (Struktur-
  Validierung beim Backup-Import), `src/features/backup/models/backup.ts`
  — `BACKUP_SCHEMA_VERSION` (aktuell 2)
- `src/features/history/historyNutritionService.ts` — Wochen-/
  Monatsübersicht (Instruktion 11), nutzt `sumDailyNutrition` unverändert
  weiter — profitiert automatisch von dieser Instruktion, ohne eigene
  Änderungen

Aktuell entspricht ein Log-Eintrag immer "einmal": bei `food` die erfasste
Grammzahl, bei `recipe` die erfassten Portionen, bei `menu` das ganze Menü
wie gebaut. Wer z.B. tagsüber einen zweiten Milchkaffee trinkt, muss dafür
bisher einen komplett neuen, identischen Eintrag anlegen.

Neues Feature: ein **Faktor** pro Log-Eintrag — "wie oft kam dieser Eintrag
an diesem Tag vor" (Default 1). Bei einem zweiten Milchkaffee genügt es,
den Faktor des bestehenden Eintrags auf 2 zu stellen, statt einen zweiten,
identischen Eintrag zu erfassen. Der Faktor ist eine **zusätzliche**
Dimension zur bestehenden Menge (Gramm bei `food`, Portionen bei `recipe`)
— nicht deren Ersatz: `amountGrams`/`servings` bleiben "wie viel pro
Vorkommen", `factor` ist neu "wie oft". Bei `menu` ist der Faktor die
einzige Mengenangabe (weiterhin kein zusätzlicher Multiplikator *innerhalb*
des Menüs nötig).

**Wichtig:** bestehende Daten im IndexedDB-`logEntries`-Store haben noch
kein `factor`-Feld. Diese Instruktion darf sie nicht korrumpieren — alte
Einträge müssen weiterhin korrekt geladen, berechnet und angezeigt werden
(Faktor wird dabei so behandelt, als wäre er 1).

---

## Aufgaben

### 1. Datenmodell
`src/features/daily-log/models/logEntry.ts`:
- Neues Feld `factor: number` auf `LogEntryBase` (gilt für alle drei
  Varianten), Kommentar: "Wie oft dieser Eintrag an diesem Tag vorkommt
  (z.B. 2 = zweimal), unabhängig von `amountGrams`/`servings`. Neue
  Einträge setzen `factor: 1` als Default."
- Bei `MenuLogEntry` den bisherigen Kommentar "Bewusst kein Multiplikator"
  entfernen/anpassen (das war Instruktion 9, gilt mit dieser Instruktion
  nicht mehr)
- Das Feld bleibt im Typ **nicht optional** (`factor: number`, nicht
  `factor?: number`) — Rückwärtskompatibilität zu alten, im IndexedDB
  bereits gespeicherten Einträgen ohne dieses Feld wird zentral an der
  Lese-Stelle behandelt (siehe Punkt 2), nicht an jeder Verwendungsstelle
  einzeln mit `?? 1`

### 2. Normalisierung beim Lesen (IndexedDB)
`src/data/indexedDbService.ts`:
- **Kein Bump von `DB_VERSION`** und **keine Migration nötig**: IndexedDB
  validiert den Inhalt eines Object Stores nicht gegen ein Schema, ein
  neues optionales Feld auf gespeicherten Objekten erfordert keine
  `upgrade()`-Änderung. Bitte kurz kommentieren, warum hier bewusst keine
  Versionserhöhung erfolgt (analog zur Begründung bei
  `requirementOverrides` in `backup.ts`)
- Neue kleine Funktion `normalizeLogEntry(entry: LogEntry): LogEntry` (oder
  gleichwertig), die ein evtl. fehlendes `factor` auf `1` setzt (`{
  ...entry, factor: entry.factor ?? 1 }` — Achtung: zur Laufzeit kann
  `entry.factor` bei alten Datensätzen `undefined` sein, auch wenn der Typ
  das nicht zulässt)
- Diese Normalisierung an **einer zentralen Stelle** anwenden, direkt bevor
  Einträge aus dem Store zurückgegeben werden: `getLogEntriesForDate`,
  `getAllLogEntries`, `getLogEntriesInRange` (alle drei Lesefunktionen)
- Damit haben ab hier alle Aufrufer (Berechnung, Anzeige, Backup-Export)
  garantiert ein konkretes `factor`, ohne dass jede Stelle einzeln
  defensiv sein muss

### 3. Nährwertberechnung
`src/features/daily-log/dailyNutritionService.ts`:
- In `calculateEntryNutrition`: das bestehende Ergebnis pro Eintrag (wie
  bisher für `food`/`recipe`/`menu` berechnet, **eine** Vorkommnis) am Ende
  **einmal zentral** mit `entry.factor` multiplizieren (analog zur
  bestehenden `servings`-Multiplikation bei `recipe` — `incomplete`-Flags
  dabei unverändert durchreichen, nur `value` skalieren)
  - Für `recipe` heisst das: zuerst `perServing * servings` (bestehende
    Logik, unverändert), danach das Gesamtergebnis zusätzlich `* factor`
    (zwei unabhängige Multiplikatoren: "wie viel pro Portion" ×
    "Portionen" × "wie oft")
- `sumDailyNutrition`/`buildDailyLogContext` benötigen **keine** Änderung
  — die Faktor-Anwendung passiert vollständig innerhalb von
  `calculateEntryNutrition`
- `src/features/history/historyNutritionService.ts` **nicht anfassen** —
  nutzt `sumDailyNutrition` unverändert und bekommt den Faktor dadurch
  automatisch korrekt in die Wochen-/Monatsübersicht

### 4. UI: genau ein Zahlenfeld pro Zeile
`src/features/daily-log/dailyLogView.ts`:
- **Kein Button mit Dialog/Prompt.** Stattdessen pro Eintrags-Zeile **ein
  einziges** `<input type="number">`-Feld, platziert **vor** dem Label
  (Zutat-/Rezept-/Menü-Namen), am linken Rand der Zeile — die Zahl ist
  damit sofort sichtbar und direkt editierbar, ohne Umweg über einen
  eigenen Bearbeiten-Schritt oder Popup
  - Bei `food`/`menu`: das Faktor-Input —
    `<input type="number" data-factor-input-id="${entry.id}"
    value="${entry.factor}" min="0" step="1" aria-label="Faktor (wie
    oft dieser Eintrag heute vorkommt)">`
  - Bei `recipe`: **statt** des Faktor-Inputs das Portionen-Input —
    `<input type="number" data-servings-input-id="${entry.id}"
    value="${entry.servings}" min="0" step="1" aria-label="Portionen">`
    — deckt "wie viel/wie oft" bei Rezepten bereits vollständig ab, ein
    zusätzliches Faktor-Feld daneben wäre für den Anwendungsfall
    redundant. `factor` bleibt im Datenmodell (Punkt 1) trotzdem auf jeder
    `RecipeLogEntry` vorhanden (Default 1, siehe `calculateEntryNutrition`
    in Punkt 3) — es wird für `recipe` nur **nicht** in der UI angezeigt/
    editiert, bleibt also praktisch dauerhaft bei 1
  - `value` als reine Zahl (kein `formatNumber`/Komma, native
    `number`-Inputs erwarten `.` als Dezimaltrennzeichen)
  - `step="1"`: die nativen Rauf-/Runter-Pfeile erhöhen/verringern in
    1er-Schritten (Normalfall: "einmal mehr/weniger"). Für einen Wert wie
    `1.1` gibt es keinen eigenen Bedienweg — direkt mit der Tastatur/dem
    Zahlenblock eintippen, das Feld erlaubt das unabhängig vom `step` der
    Pfeile
  - **Wichtig:** `min="0"`, nicht `min="0.1"` — die Pfeiltasten runden bei
    Browsern (HTML-Spec `stepUp`/`stepDown`) auf das nächste Vielfache von
    `step` **ab `min`** auf, nicht ab 0. Mit `min="0.1"` läge das Raster bei
    0.1/1.1/2.1/…, wodurch ein Klick auf "rauf" bei Wert `1` fälschlich zu
    `1.1` statt `2` springt. Die eigentliche `> 0`-Validierung passiert
    ohnehin im jeweiligen `change`-Handler, `min="0"` ist nur der native
    Anhaltspunkt für die Pfeiltasten
  - Label enthält keine Mengenangabe mehr als Text: `food` bleibt bei
    `"Vollmilch — 200 g"` (Gramm sind hier bewusst weiterhin Text, nicht
    Teil dieser Instruktion), `recipe` wird zu reinem `recipe.name` (ohne
    `"— X Portionen"`-Suffix, siehe oben), `menu` bleibt bei
    `"Menüname — ganzes Menü"`
  - Input nicht anzeigen bei `missing: true` (referenziertes Rezept/
    Menü/Zutat existiert nicht mehr) — dort ergibt keine der beiden Zahlen
    einen Sinn
- Reagiert auf das `change`-Event (nicht `input`) — übernimmt den Wert
  erst bei Verlassen des Feldes/Enter, nicht bei jedem Tastendruck
  - Validieren: Zahl, `> 0` — bei ungültiger Eingabe `window.alert` und das
    Feld auf den bisherigen Wert zurücksetzen (gleiche Logik für Faktor-
    und Portionen-Input, kein Code duplizieren, gemeinsame kleine
    Hilfsfunktion möglich)
  - Bei gültiger Eingabe: Eintrag mit neuem `factor` bzw. `servings`
    speichern — dafür **keine neue IndexedDB-Funktion nötig**,
    `addLogEntry`/`updateLogEntry` ist bereits ein Upsert (`db.put` mit
    `keyPath: 'id'`) und überschreibt den bestehenden Eintrag
  - Nach dem Speichern: Chart + Liste sofort neu berechnen (gleiches
    Re-Render-Muster wie beim Entfernen eines Eintrags,
    `renderDailyLogView(options)` erneut aufrufen)
- CSS: eine gemeinsame, schmale Input-Klasse für beide Feld-Varianten (fixe
  Breite, `min-height: 44px` für Touch-Ziele, gleiche Design-Tokens wie
  die übrigen Formularfelder) statt des Browser-Default-Stylings für
  `type="number"`

`src/features/daily-log/addLogEntryView.ts`:
- Das `window.prompt('Wie viele Portionen hast du gegessen?', '1')`-Popup
  bei Rezepten **entfernen** — es wurde als hässlich/störend empfunden.
  Rezept-Auswahl fügt den Eintrag stattdessen **direkt** hinzu, exakt wie
  bereits bei Menüs (`onClick` → `addLogEntry(...)`, kein Zwischenschritt)
- Neue Rezept-Einträge starten mit `servings: 1, factor: 1` als Default
  — beides danach direkt im Log über die neuen Inputs (Punkt oben)
  anpassbar. Kein Abfrageschritt beim Hinzufügen nötig, das deckt den
  Anwendungsfall "andere Portionenzahl" jetzt das Log selbst ab
- Bei `food`/`menu` ändert sich am Hinzufügen-Flow nichts (Menü blieb
  bereits Direkt-Hinzufügen ohne Popup, Zutat behält die
  Gramm-Mengenabfrage über `foodPickerControl.ts` — nicht Teil dieser
  Instruktion)

### 5. Backup
- `src/features/backup/backupService.ts`, `isValidLogEntry`: `factor`
  **optional** validieren — falls das Feld vorhanden ist, muss es
  `typeof v.factor === 'number'` sein, falls es fehlt (alte Backups vor
  dieser Instruktion), bleibt der Eintrag trotzdem gültig
- **Kein** Bump von `BACKUP_SCHEMA_VERSION`: anders als bei `customFoods`
  (Instruktion 13, dort hätte ein fehlendes Feld beim Import zu
  stillschweigendem Datenverlust geführt) geht beim Fehlen von `factor` in
  einem alten Backup nichts verloren — der Eintrag wird beim nächsten Lesen
  über `normalizeLogEntry` (Punkt 2) automatisch mit `factor: 1`
  vervollständigt, exakt das fachlich korrekte Verhalten für einen
  Alt-Eintrag. Gleiche Begründung wie beim `requirementOverrides`-Update in
  `backup.ts` (siehe Kommentar dort) — bitte analog ergänzen
- `exportBackup`/`getAllLogEntries` liefern dank Punkt 2 automatisch immer
  ein explizites `factor` je Eintrag — keine weitere Änderung im Export
  nötig

### 6. Tests
- `dailyNutritionService.test.ts`: Testfall, der `calculateEntryNutrition`
  bzw. `sumDailyNutrition` mit `factor: 2` prüft (Nährwerte verdoppeln
  sich gegenüber `factor: 1`), sowie einen Testfall für `recipe` mit
  `servings` **und** `factor` gleichzeitig ungleich 1 (beide multiplizieren
  sich)
- `indexedDbService.test.ts`: Testfall für `normalizeLogEntry`/die
  Lesefunktionen — ein roh in den Store geschriebenes Objekt **ohne**
  `factor`-Feld (simuliert einen Alt-Eintrag) wird beim Lesen mit
  `factor: 1` zurückgegeben, nicht `undefined` und nicht abstürzend
- `backupService.test.ts`: bestehenden `isValidLogEntry`-Testfall um einen
  Fall ohne `factor` (gültig) und einen mit ungültigem `factor`
  (z.B. String statt Zahl, ungültig) ergänzen

---

## Was NICHT Teil dieses Auftrags ist
- Kein Bearbeiten von `foodId`/`recipeId`/`menuId`/`amountGrams` eines
  bestehenden Eintrags — editierbar sind nur `factor` (alle Typen) und
  `servings` (nur `recipe`), alles andere bleibt bei "nur Hinzufügen/
  Entfernen" wie in Instruktion 9 festgelegt
- Keine Faktor-Abfrage im Hinzufügen-Flow (`addLogEntryView.ts`) — Default
  1 beim Anlegen reicht, siehe Punkt 4
- Keine Migration/Bump von `DB_VERSION` oder `BACKUP_SCHEMA_VERSION` — in
  beiden Fällen reicht ein sauberer Default-Fallback für fehlende Werte
  (siehe Punkte 2 und 5), da kein Datenverlust droht
- Kein negativer oder Faktor `= 0` (wie bei der bestehenden
  Portionen-Validierung: nur Zahlen `> 0`)
- Keine Anzeige/Bearbeitung des Faktors in der Wochen-/Monatsübersicht
  (Instruktion 11) — dort wird ohnehin nur die bereits aufsummierte
  Tagesaufnahme gezeigt, kein Einzeleintrag

## Nach Abschluss
Bitte zeigen:
- Kurzer Ablauf: Milchkaffee (Menü oder Rezept, je nachdem wie aktuell
  modelliert) heute einmal loggen → das Zahlenfeld direkt vor dem Eintrag
  (Faktor bei Menü, Portionen bei Rezept) auf 2 stellen → Chart/Zahlen
  verdoppeln sich sofort
- Bestätigen, dass ein **vor** dieser Instruktion angelegter Log-Eintrag
  (ohne `factor` im IndexedDB) weiterhin korrekt geladen wird, mit Faktor 1
  angezeigt wird und sich normal bearbeiten/entfernen lässt — idealerweise
  kurz demonstriert (z.B. Eintrag manuell ohne `factor` in die DB
  geschrieben, dann im Log geöffnet)
- Bestätigen, dass ein Backup-Export/Import ohne Datenverlust funktioniert,
  auch mit einer alten Backup-Datei ohne `factor`-Feld in den Log-Einträgen
