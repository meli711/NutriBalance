# Instruktion 11: Verlauf — Wochen-/Monatsübersicht pro Nährstoff

## Kontext
Aufbauend auf:
- `src/features/daily-log/dailyNutritionService.ts` — `calculateDailyNutrition(date)`,
  die reine Kernfunktion `sumDailyNutrition(entries, context)` und der
  interne `buildContext(entries)` (lädt Zutaten/Rezepte/Menüs für eine
  Menge von Log-Einträgen)
- `src/data/indexedDbService.ts` — `logEntries`-Store mit Index `by-date`
  (Instruktion 9), bisher nur tageweise abgefragt (`getLogEntriesForDate`)
- `src/features/nutrient-requirements/requirementService.ts` —
  `getRequirementsForProfile(profile, overrides)`
- `src/features/recipes/dailyRequirementPercentage.ts` —
  `resolveComparableTarget(requirement, amountUnit, energyRequirementKcal)`,
  `getEnergyRequirementKcal(requirements)` (rechnet einen Referenzwert in
  dieselbe Einheit um wie die berechnete Aufnahme — hier für die
  Bedarfs-Linie wiederverwenden, nicht duplizieren)
- `src/features/charts/nutrientComparisonChart.ts` — bestehendes Muster für
  Chart.js-Einbindung (nur benötigte Bausteine registrieren, Farben aus den
  `--chart-color-*`-CSS-Variablen, Umschalt-Buttons)
- `src/app/appNav.ts` / `src/app/main.ts` — persistente Hauptnavigation
- `src/data/localStorageService.ts` — Muster für validiertes Lesen/Schreiben
  in `localStorage` (`parseStored…` + `isValid…`)
- `src/utils/date.ts` — `getLocalDateString`, `addDaysToDateString`,
  `formatDateLabel`

Ziel: eine neue Seite **"Verlauf"**, die zeigt, wie sich die tägliche
Nährstoff**aufnahme** über einen Zeitraum (Woche oder Monat) entwickelt hat
— z.B. "wie hat sich mein Protein-Konsum in den letzten 7 Tagen verändert".
Dargestellt als Liniendiagramm über die Zeit, mit dem **Bedarf** des
jeweiligen Nährstoffs als Referenzlinie. Die dargestellten Nährstoffe sind
auswählbar, die Auswahl wird in `localStorage` gespeichert.

Das ist bewusst die Aggregation über mehrere Tage, die in Instruktion 9
ausdrücklich **nicht** Teil des Tages-Logs war ("Kein Wochen-/
Monatsüberblick") — sie kommt jetzt als eigene Seite dazu, ohne das
Tages-Log zu verändern.

---

## Aufgaben

### 1. Zeitraum-Helfer in `src/utils/date.ts`
- `getDateRange(endDateStr: string, days: number): string[]` — liefert die
  `days` lokalen Datums-Strings, die auf `endDateStr` enden (aufsteigend
  sortiert, `endDateStr` als letztes Element). Über `addDaysToDateString`
  aufbauen, keine eigene Datumsarithmetik.
- `formatShortDateLabel(dateStr: string): string` — kompakte Achsen-
  beschriftung, z.B. `Mo 1.9.` (Wochentag-Kürzel + Tag.Monat., über
  `toLocaleDateString('de-CH', …)`). Für die Monatsansicht wird dasselbe
  Label verwendet (auf schmalen Viewports greift Chart.js' `maxTicksLimit`,
  siehe Punkt 5) — kein separates Format nötig.

### 2. Bereichs-Abfrage in `src/data/indexedDbService.ts`
- `getLogEntriesInRange(startDate: string, endDate: string): Promise<LogEntry[]>`
  - nutzt den bestehenden `by-date`-Index mit
    `IDBKeyRange.bound(startDate, endDate)` — **eine** Abfrage über den
    ganzen Zeitraum, nicht pro Tag einzeln in einer Schleife, und nicht den
    ganzen Store laden und im Speicher filtern
  - `startDate`/`endDate` inklusive

### 3. Aggregation pro Tag über einen Zeitraum
`src/features/history/historyNutritionService.ts`:
- Aus `dailyNutritionService.ts` den bisher internen `buildContext` als
  `buildDailyLogContext(entries)` **exportieren** und hier wiederverwenden —
  der Kontext (Zutaten/Rezepte/Menüs) wird **einmal für alle Einträge des
  Zeitraums** gebaut, nicht pro Tag neu (sonst lädt ein 30-Tage-Verlauf die
  Lebensmitteldatenbank-Einträge x-fach). `calculateDailyNutrition` bleibt
  unverändert und baut seinen Kontext weiterhin selbst.
- Reine Kernfunktion (synchron, ohne I/O — analog zu `sumDailyNutrition`,
  für `node:test` testbar):
  ```ts
  sumNutritionByDate(
    dates: string[],
    entries: LogEntry[],
    context: DailyLogContext,
  ): Map<string /* date */, NutrientValues>
  ```
  - gruppiert `entries` nach `entry.date`, ruft pro Datum das bestehende
    `sumDailyNutrition` auf
  - **jedes** Datum aus `dates` kommt in der Map vor — Tage ohne Einträge
    mit einem leeren `NutrientValues` (`[]`), nicht ausgelassen (die Seite
    muss "an dem Tag nichts geloggt" von "an dem Tag kein Protein" sauber
    unterscheiden können, siehe Punkt 4)
  - `incomplete`-Flags wie gehabt durchreichen (`sumDailyNutrition` macht
    das bereits)
- Dünner I/O-Wrapper:
  ```ts
  calculateNutritionHistory(
    dates: string[],
  ): Promise<Map<string, NutrientValues>>
  ```
  - `getLogEntriesInRange(dates[0], dates.at(-1))`, Kontext bauen,
    `sumNutritionByDate` aufrufen

### 4. Einstellungen in `localStorage`
`src/data/localStorageService.ts` um einen weiteren Schlüssel erweitern,
nach dem bestehenden Muster (`parseStored…` + `isValid…`, beschädigte/
fremde Daten → Default statt Fehler):
- Key `nutribalance:historySettings`, Wert:
  ```ts
  interface HistorySettings {
    nutrientIds: string[]        // welche Nährstoffe im Chart
    period: 'week' | 'month'     // 7 bzw. 30 Tage bis heute
  }
  ```
- `getHistorySettings(): HistorySettings` / `saveHistorySettings(s): void`
- Validierung:
  - `nutrientIds` ist ein Array von Strings; unbekannte IDs (nicht in
    `NUTRIENT_LABELS`) werden herausgefiltert, nicht als Fehler behandelt
  - nach dem Filtern leer → Default
  - `period` nur `'week'` oder `'month'`, sonst Default
- Default: `{ nutrientIds: ['protein'], period: 'week' }` (Protein ist das
  Beispiel im Auftrag; bewusst nur einer, damit der erste Eindruck der Seite
  aufgeräumt ist)

### 5. Chart-Komponente
`src/features/history/historyChart.ts`:
- **Pro ausgewähltem Nährstoff ein eigenes Liniendiagramm** (untereinander),
  nicht alle Nährstoffe in einem Chart — dasselbe Argument wie in
  Instruktion 5 (Protein in g und Vitamin C in mg in einer Achse ist
  unlesbar). Muster: `ensureBarCharts` in `nutrientComparisonChart.ts`
  rendert bereits ein Chart pro Nährstoff.
- Pro Nährstoff-Chart:
  - X-Achse: die Tage des Zeitraums (`formatShortDateLabel`), auf schmalen
    Viewports `ticks.maxTicksLimit` setzen, damit die Beschriftung im
    Monatsmodus nicht überläuft
  - Y-Achse: Wert in der Einheit des Nährstoffs (`UNIT_LABELS`),
    `beginAtZero: true`
  - Datenreihe "Aufnahme": Wert pro Tag aus der Map (Tag ohne Log-Eintrag →
    `0`), Farbe `--chart-color-intake`
  - Datenreihe "Bedarf": waagrechte Linie auf dem umgerechneten Zielwert,
    gestrichelt, Farbe `--chart-color-requirement`, `pointRadius: 0` —
    Zielwert über `resolveComparableTarget(requirement, amountUnit,
    getEnergyRequirementKcal(requirements))` (nicht neu rechnen)
  - Gibt es für den Nährstoff **keinen** vergleichbaren Referenzwert
    (`resolveComparableTarget` → `null`, z.B. Ballaststoffe als
    `g/1000kcal`, oder `%energy` ohne Energie-Ziel): Chart trotzdem zeigen,
    aber ohne Bedarfs-Linie + kurzer Hinweis darunter ("Für diesen
    Nährstoff ist für dein Profil kein direkter Vergleichswert hinterlegt.")
    — **nicht** eine 0-Linie oder den Rohwert als Bedarf zeichnen
  - Nur die tatsächlich gebrauchten Chart.js-Bausteine registrieren
    (`LineController`, `LineElement`, `PointElement`, `LinearScale`,
    `CategoryScale`, `Filler`, `Tooltip`, `Legend`) — gleiche Begründung
    (Bundle-Grösse) wie in `nutrientComparisonChart.ts`. Registrierung ist
    idempotent, aber trotzdem nur das Nötige.
- Tage mit `incomplete: true` für diesen Nährstoff: kein eigenes Markieren
  im Chart nötig, aber **ein** Sammelhinweis unter dem Chart, falls
  irgendein Tag im Zeitraum betroffen war ("An Tagen mit fehlenden
  Datenbankwerten ist der angezeigte Wert eine Unterschätzung.")
- Rückgabe wie die bestehende Chart-Komponente: `{ destroy() }`, das alle
  erzeugten `Chart`-Instanzen aufräumt.

### 6. Seite "Verlauf"
`src/features/history/historyView.ts` — `renderHistoryView({ container, profile })`:
- Überschrift `<h1>Verlauf</h1>` + kurzer erklärender Satz ("Wie sich deine
  tägliche Aufnahme über die Zeit entwickelt hat, im Vergleich zu deinem
  Bedarf.")
- **Zeitraum-Umschalter** "Woche" / "Monat" — Muster/Klassen von
  `.nutrient-chart__toggle` wiederverwenden. Auswahl sofort anwenden und in
  `historySettings.period` speichern.
- **Nährstoff-Auswahl**: eine Reihe Umschalt-Chips/Checkboxen für alle
  Nährstoffe aus `NUTRIENT_LABELS` (Energie, Protein, Fett, Kohlenhydrate,
  Ballaststoffe, Calcium, Eisen, Vitamin C). Änderung → sofort
  `historySettings.nutrientIds` speichern und Charts neu rendern.
  - **mindestens einer muss aktiv bleiben**: das Abwählen des letzten
    aktiven Nährstoffs verhindern (Chip deaktiviert lassen / Klick
    ignorieren), damit die Seite nie ganz ohne Chart dasteht
- **Charts**: `renderHistoryChart` mit
  - `dates = getDateRange(getLocalDateString(new Date()), period === 'week' ? 7 : 30)`
  - `history = await calculateNutritionHistory(dates)`
  - `requirements = getRequirementsForProfile(profile, getRequirementOverrides())`,
    defensiv in `try/catch` (kein DACH-Wert für die Altersgruppe →
    Charts ohne Bedarfs-Linie, gleiche Behandlung wie `getRequirementsSafely`
    in `dailyLogView.ts`)
  - `nutrientIds` aus den Einstellungen
- **Ladezustand** während `calculateNutritionHistory` läuft (kurzer Text,
  wie in `dailyLogView.ts`).
- **Leerer Zustand**: gibt es im ganzen Zeitraum **keinen einzigen**
  Log-Eintrag → kein leeres Chart, stattdessen Hinweis ("Für diesen Zeitraum
  ist noch nichts im Tages-Log erfasst.") + Button/Link, der zum Log führt
  (über den `onNavigate`-Mechanismus der App, siehe Punkt 7). Die
  Zeitraum-/Nährstoff-Auswahl bleibt trotzdem sichtbar.
- Bei jedem Wechsel (Zeitraum, Nährstoffauswahl) die alte Chart-Instanz
  `destroy()`en, bevor neu gerendert wird (Muster: `destroyActiveSummary`
  in `dailyLogView.ts`) — kein Chart.js-Leak.

### 7. Navigation
- `src/app/appNav.ts`: `NavSection` um `'verlauf'` erweitern, `NAV_ITEMS`
  um `{ section: 'verlauf', label: 'Verlauf' }` — direkt **nach** `'log'`
  (inhaltlich am nächsten dran).
- `src/app/main.ts`:
  - `import { renderHistoryView } from '../features/history/historyView.ts'`
  - `showHistory(profile)` analog zu `showView` (`updateNav(profile,
    'verlauf')`, dann rendern)
  - `case 'verlauf':` in `navigateTo` → `showHistory(profile)`
  - der Log-Link aus dem leeren Zustand (Punkt 6) ruft
    `showDailyLog(profile, getLocalDateString(new Date()))` bzw. den
    `navigateTo(profile, 'log')`-Weg auf — keine Sonderlogik, nur den
    vorhandenen Übergang nutzen

### 8. Styling
- `src/styles/main.css`: Abschnitt für die Verlauf-Seite. Chips/Toggles an
  `.nutrient-chart__toggle*` anlehnen, die einzelnen Nährstoff-Charts mit
  fester Höhe (wie `.nutrient-chart__bar-canvas`) und Abstand untereinander.
  Farben ausschliesslich aus den bestehenden `--chart-color-*` /
  `--color-*`-Variablen (Design-Konsistenz, siehe `DESIGN.md`).
- Responsive: auf iPhone-Breite müssen die Charts lesbar bleiben
  (`maintainAspectRatio: false` + Container-Höhe, `maxTicksLimit` auf der
  X-Achse), die Chip-Reihe umbricht (`flex-wrap`).

### 9. Tests
- `sumNutritionByDate` (rein, `node:test`):
  - gemischte Einträge über mehrere Tage → korrekte Summe pro Tag (von Hand
    nachrechenbares Beispiel)
  - ein Datum im `dates`-Array ohne Einträge → in der Map vorhanden mit `[]`
  - `incomplete` wird pro Tag korrekt durchgereicht
- `getDateRange` (rein): 7 bzw. 30 aufsteigende lokale Datums-Strings,
  letztes Element = `endDateStr`, korrekt über einen Monatswechsel hinweg
- `localStorageService`:
  - `parseStoredHistorySettings`: unbekannte Nährstoff-IDs werden
    herausgefiltert; leere/kaputte/fremde Daten → Default; ungültiges
    `period` → Default
- `formatShortDateLabel` (rein): erwartetes Format, unabhängig von der
  Tageszeit lokal korrekt (analog zum bestehenden `date.test.ts`)

---

## Was NICHT Teil dieses Auftrags ist
- Kein frei wählbarer Datumsbereich (Von–Bis-Picker) — nur die zwei
  Voreinstellungen "Woche" (7 Tage) und "Monat" (30 Tage), jeweils bis
  heute
- Keine Kalendermonats-Logik (immer "die letzten N Tage", nicht "1.–30.
  September")
- Kein gleitender Durchschnitt, keine Trendlinie/Regression, keine Prognose
- Kein Vergleich zweier Zeiträume nebeneinander
- Keine Aufschlüsselung, welche Mahlzeit/welches Rezept an einem Tag wie
  viel beigetragen hat (dafür bleibt das Tages-Log da)
- Kein Export / kein Screenshot der Verlaufs-Charts
- Keine Vorberechnung/Cache der Tagessummen — bei jedem Öffnen frisch
  aus IndexedDB rechnen (der Zeitraum ist klein genug)
- Das Tages-Log (`dailyLogView.ts`) und `calculateDailyNutrition` werden
  **nicht** verändert (nur `buildContext` wird exportiert, um ihn zu teilen)

## Nach Abschluss
Bitte zeigen:
- Kurzer Ablauf: an mehreren Tagen etwas ins Log eintragen → "Verlauf"
  öffnen → Wochen-Chart für Protein mit Bedarfs-Linie → auf "Monat"
  umschalten → einen zweiten Nährstoff (z.B. Eisen) dazuwählen → Seite neu
  laden und bestätigen, dass Auswahl + Zeitraum aus `localStorage` erhalten
  bleiben
- Bestätigen, dass der Kontext (Zutaten/Rezepte/Menüs) für den ganzen
  Zeitraum nur einmal gebaut wird (nicht pro Tag) und `getLogEntriesInRange`
  den `by-date`-Index nutzt
- Kurz beschreiben, wie ein Tag ohne Log-Eintrag im Chart dargestellt wird
  (0) und wie das vom Fall "kein Referenzwert vorhanden" unterschieden wird
