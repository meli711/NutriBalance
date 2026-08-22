# Instruktion 9: Tages-Log

## Kontext
Aufbauend auf:
- `src/features/recipes/` — Rezepte + `calculateRecipeNutrition`/
  `calculatePerServing`
- `src/features/menu-builder/` — eigene Menüs (IndexedDB)
- `src/data/foodDatabaseService.ts` — einzelne Zutaten
- `src/features/charts/nutrientComparisonChart.ts` — generische
  Bedarf-vs-Aufnahme-Chart-Komponente
- `src/data/indexedDbService.ts` — bereits mit `menus`-Object-Store befüllt
  (Instruktion 6), wird jetzt um einen zweiten Store erweitert

Neues Kern-Feature: ein **Tages-Log**. Für einen ausgewählten Tag können
Rezepte, eigene Menüs oder einzelne Zutaten als "gegessen" erfasst werden.
Die App summiert daraus die kumulierte Tages-Nährstoffaufnahme und zeigt sie
im Vergleich zum Bedarf (Chart + Zahlen). Es lässt sich zwischen Tagen
vor- und zurücknavigieren.

**Dies wird der neue Standard-Startbildschirm der App** (nach dem
Profil-Check aus Instruktion 3): ist ein Profil vorhanden, startet die App
direkt im Log des heutigen Tages, statt in der reinen Bedarfs-Anzeige.

---

## Aufgaben

### 1. Datenmodell
`src/features/daily-log/models/logEntry.ts`:
```ts
type LogEntry =
  | { id: string; date: string /* YYYY-MM-DD, lokales Datum */;
      type: 'food'; foodId: string; amountGrams: number }
  | { id: string; date: string;
      type: 'recipe'; recipeId: string; servings: number }
  | { id: string; date: string;
      type: 'menu'; menuId: string };
```
- `date` als reines Datum ohne Uhrzeit (String `YYYY-MM-DD`), **lokales
  Datum verwenden, nicht UTC** — sonst verschiebt sich der Tag je nach
  Zeitzone/Tageszeit falsch. Bitte eine kleine Utility-Funktion
  `getLocalDateString(d: Date): string` zentral ablegen und überall
  konsequent verwenden (auch für "heute")
- Bei `recipe`: `servings` = Anzahl gegessener Portionen (kann auch z.B.
  0.5 sein — Nutzer:in isst nur eine halbe Portion)
- Bei `menu`: kein zusätzlicher Multiplikator — ein geloggter Menü-Eintrag
  entspricht dem ganzen Menü, wie es erstellt wurde (das reicht für den
  aktuellen Scope, keine Überengineering nötig)

### 2. IndexedDB Object Store
In `src/data/indexedDbService.ts`:
- Neuer Object Store `logEntries`, mit **Index auf `date`** (wichtig für
  effiziente Abfrage pro Tag, nicht das ganze Array laden und im Speicher
  filtern)
- Funktionen: `addLogEntry(entry: LogEntry): Promise<void>`,
  `removeLogEntry(id: string): Promise<void>`,
  `getLogEntriesForDate(date: string): Promise<LogEntry[]>`

### 3. Nährstoffberechnung pro Tag
`src/features/daily-log/dailyNutritionService.ts`:
- Funktion `calculateDailyNutrition(date: string): Promise<NutrientValues>`
  - lädt alle `LogEntry`s für den Tag
  - für jeden Eintrag die passenden Nährwerte berechnen:
    - `food`: einzelne Zutat + Menge (bestehende Low-Level-Funktion aus
      `nutritionCalculator` wiederverwenden — falls es dort noch keine
      Funktion für **eine einzelne** Zutat gibt, bitte
      `calculateNutritionForIngredients` aus Instruktion 6 nutzen, mit
      einem Array aus nur einem Element)
    - `recipe`: `calculatePerServing(recipe)` Ergebnis mit `servings`
      multiplizieren
    - `menu`: `calculateNutritionForIngredients(menu.ingredients)`
      unverändert
  - alle Einzel-Ergebnisse zu einer Tages-Summe addieren (bestehende
    Summierungslogik wiederverwenden, nicht neu schreiben)
  - `incomplete`-Flags (fehlende Datenbankwerte, siehe Instruktion 4)
    korrekt weiterreichen: wenn auch nur ein Beitrag zu einem Nährstoff
    unvollständig war, muss das Tagesergebnis für diesen Nährstoff ebenfalls
    als unvollständig markiert sein

### 4. Neue Seite: Tages-Log
```
src/features/daily-log/
  dailyLogView.ts        # Hauptscreen
  addLogEntryView.ts      # "Hinzufügen"-Flow (Auswahl Rezept/Menü/Zutat)
```

**a) `dailyLogView.ts`**
- Kopfbereich: Datums-Navigation — "◀" / aktuelles Datum (z.B. "Heute,
  22. August 2026" bzw. Wochentag + Datum bei anderen Tagen) / "▶"
  - Vorwärts-Navigation **nicht über das heutige Datum hinaus** erlauben
    (Verbrauch in der Zukunft loggen ergibt fachlich keinen Sinn) — Button
    bei "heute" deaktivieren oder ausblenden
  - Rückwärts-Navigation unbegrenzt erlauben
- Liste der geloggten Einträge für den gewählten Tag: Name (Rezept-/Menü-/
  Zutatname), Mengenangabe (Portionen bzw. Gramm), Entfernen-Button (✕) pro
  Eintrag
- Leerer Zustand (kein Eintrag für diesen Tag): kurzer Hinweistext + gut
  sichtbarer "Hinzufügen"-Button, kein leeres Chart ohne Kontext anzeigen
- Kumulierte Tagesübersicht: bestehende `nutrientComparisonChart`-Komponente
  wiederverwenden — Input ist `calculateDailyNutrition(date)` (Aufnahme)
  gegen `getRequirementsForProfile(profile)` (Bedarf), exakt wie bei
  Rezepten/Menüs, nur mit der Tages-Summe statt einem einzelnen Rezept
- Bei jeder Änderung (Eintrag hinzugefügt/entfernt) Chart + Liste sofort
  neu berechnen, kein manueller Reload nötig

**b) `addLogEntryView.ts`**
- Einfache Auswahl: "Rezept" / "Menü" / "Zutat" (z.B. drei Tabs oder Buttons)
- **Rezept**: Liste/Suche über `recipeService.getAllRecipes()`, danach
  Portionenzahl abfragen (Default 1, Dezimalwerte erlauben)
- **Menü**: Liste über gespeicherte Menüs (`getAllMenus()` aus Instruktion 6)
  — direkt hinzufügbar, keine weitere Mengenangabe nötig
- **Zutat**: bestehende Zutaten-Suche (`searchFoodsByName`, gleiches Muster
  wie im Menü-Builder aus Instruktion 6), danach Menge in Gramm abfragen
- Nach Auswahl + Bestätigen: `LogEntry` mit dem aktuell angezeigten Datum
  (aus `dailyLogView`) erzeugen, via `addLogEntry()` speichern, zurück zur
  Log-Ansicht

### 5. Navigation/Einstiegspunkt anpassen
- `src/app/` anpassen: nach Profil-Check (Instruktion 3) direkt zu
  `dailyLogView` mit `date = getLocalDateString(new Date())` (heute)
  wechseln, statt zur reinen Bedarfs-Anzeige
- Die bestehende Bedarfs-Anzeige (`profileView.ts`) bleibt bestehen und
  erreichbar (z.B. über Navigation/Menü — "Mein Bedarf"), wird aber nicht
  mehr automatischer Startbildschirm
- Bestehende Navigation (Rezepte, eigene Menüs, Profil bearbeiten) weiterhin
  von überall erreichbar halten — bitte prüfen, wie der aktuelle
  Navigations-/Menübereich strukturiert ist, und Log dort sinnvoll als
  primären Eintrag einordnen

### 6. Edge Cases
- Entfernen des letzten Eintrags eines Tages → sauber zurück zum leeren
  Zustand, kein Absturz
- Navigation zu einem Tag ohne Profil-Bedarfsdaten (sollte nicht vorkommen,
  da Profil-Check vorgelagert ist, aber defensiv behandeln)
- Gelöschtes Rezept/Menü, das noch in einem alten `LogEntry` referenziert
  wird (z.B. falls später mal Lösch-Funktionen für Rezepte dazukommen) —
  für jetzt reicht es, das defensiv abzufangen (Eintrag überspringen +
  evtl. dezenter Hinweis), kein Muss für diesen Umfang, aber nicht abstürzen

### 7. Tests
- Unit-Test `calculateDailyNutrition`: mehrere gemischte Einträge (Rezept +
  Zutat + Menü) an einem Tag ergeben die erwartete Summe (von Hand
  nachrechenbares Beispiel)
- Unit-Test `getLocalDateString`: korrektes lokales Datum unabhängig von
  Tageszeit/Zeitzone

---

## Was NICHT Teil dieses Auftrags ist
- Kein Bearbeiten eines bestehenden Log-Eintrags (nur Hinzufügen/Entfernen)
- Kein Wochen-/Monatsüberblick (nur Einzeltag-Navigation)
- Keine Multiplikator-Option für Menüs (ganzes Menü = 1 Eintrag, siehe oben)
- Keine Erinnerungen/Benachrichtigungen

## Nach Abschluss
Bitte zeigen:
- Kurzer Ablauf: heutiges Log öffnen → Rezept + Zutat hinzufügen → Chart
  zeigt kumulierte Werte → einen Tag zurücknavigieren (leer) → wieder vor
- Bestätigen, dass die Datums-Handhabung lokal (nicht UTC) korrekt ist,
  idealerweise mit einem kurzen Testfall nahe Mitternacht beschrieben
