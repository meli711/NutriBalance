# Instruktion 12: Eigene Markenprodukte in der Lebensmitteldatenbank

## Kontext
Aufbauend auf:
- `scripts/convert-food-db.ts` — erzeugt `public/data/food-database.json`
  aus dem Excel-Export der Schweizer Nährwertdatenbank (BLV), inkl.
  `toFoodItem(row)` und `main()`
- `src/data/models/food.ts` — `FoodItem` (Struktur eines Eintrags in der
  Ausgabedatei, Werte pro 100 g)
- `.gitignore` — `quellen/` ist als Rohdaten Dritter komplett ausgenommen
  (siehe Instruktion "Rohdaten Dritter aus dem Repo entfernen"), Herkunft
  dokumentiert in `README.md`
- `vite.config.ts` — `vite-plugin-pwa` mit `registerType: 'autoUpdate'`,
  Abschnitt `workbox` (bisher nur `runtimeCaching` für Google Fonts, keine
  eigenen `globPatterns`)

Ziel: Markenprodukte, die Meliane regelmässig isst (z.B. ein bestimmter
High-Protein-Drink, Skyr), gibt es in der **generischen** BLV-Datenbank
nicht. Sie sollen sich pflegen und mit dem generischen Datenbestand
zusammenführen lassen, **ohne** die generierte `food-database.json` von
Hand zu editieren (die wird bei jedem `npm run convert:food-db`
überschrieben) und ohne einen zweiten Datenpfad in der App.

Zusätzlich fiel dabei auf: Wenn sich die `food-database.json` durch neue
eigene Produkte ändert, bekommen bestehende PWA-Clients den neuen
Datenstand nicht zuverlässig — die JSON-Dateien in `public/data/` sind gar
nicht im Precache-Manifest des Service Workers. Das wird hier gleich
mitbehoben.

---

## Aufgaben

### 1. Quelldatei für eigene Produkte
- Neue Datei `quellen/eigene-produkte.json`: ein JSON-Array von
  `FoodItem`-Objekten (dieselbe Struktur wie ein Eintrag in der
  Ausgabedatei), Werte pro 100 g.
- Die `id` bewusst mit Präfix `custom-` vergeben (z.B.
  `custom-skyr-nature`), damit eigene Einträge in der zusammengeführten
  Datei erkennbar bleiben und nicht zufällig mit einer BLV-`id`
  kollidieren.
- Felder, für die kein belastbarer Wert vorliegt (die meisten Vitamine/
  Mineralstoffe auf Verpackungen), als `{ "value": null, "unit": … }` —
  nicht raten, nicht `0`.

### 2. `.gitignore`: Ausnahme für die eigene Quelldatei
- `quellen/` bleibt ignoriert (Rohdaten Dritter), aber
  `quellen/eigene-produkte.json` wird **eingecheckt** — das sind _unsere_
  Daten, und nur so kann `npm run convert:food-db` die
  `food-database.json` auf jedem Clone reproduzieren.
- Umsetzung über `quellen/*` + `!quellen/eigene-produkte.json` mit einem
  kurzen Kommentar, warum diese eine Datei die Ausnahme ist.

### 3. `convert-food-db.ts`: eigene Produkte einmischen
- Pfadkonstante `CUSTOM_PRODUCTS_FILE` (→ `quellen/eigene-produkte.json`)
  mit Doc-Kommentar zur Herkunft/`.gitignore`-Ausnahme.
- `mergeCustomProducts(foods: FoodItem[]): number`:
  - Datei fehlt (`existsSync` → false) → `foods` unverändert lassen,
    `0` zurückgeben (der generische Konvertierungslauf muss auch ohne die
    Datei durchlaufen)
  - Inhalt parsen; ist es kein Array → klarer Fehler mit Dateiname
  - pro Eintrag `assertFoodItem` (siehe unten), dann:
    - `id` existiert bereits in `foods` → generischen Eintrag **an Ort und
      Stelle** ersetzen (Reihenfolge bleibt stabil)
    - neue `id` → anhängen
  - Zuordnung `id → Index` über eine `Map` (kein `findIndex` in der
    Schleife)
  - Rückgabe: Anzahl verarbeiteter eigener Einträge
- `assertFoodItem(item, index): asserts item is FoodItem` — **grobe**
  Pflichtfeldprüfung (`id` nicht leer, `name.de` vorhanden, `category`
  vorhanden, `vitamins`/`minerals` vorhanden), kein vollständiges Schema.
  Zweck: ein Tippfehler in der Quelldatei fällt hier auf, nicht erst in
  der App. Fehlermeldung nennt die Position (`eigene-produkte.json[<i>]`).
- In `main()` nach dem Erzeugen der generischen Liste aufrufen; die
  Abschluss-Logzeile so anpassen, dass generische und eigene Anzahl
  getrennt sichtbar sind (z.B.
  `12345 generische + 2 eigene → 12347 Lebensmittel → …`).

### 4. `vite.config.ts`: JSON ins Precache-Manifest
- Im `workbox`-Abschnitt `globPatterns` explizit setzen und `json`
  (sowie `woff`/`woff2`) zusätzlich zu den Default-Endungen aufnehmen:
  `['**/*.{js,css,html,ico,png,svg,jpg,jpeg,json,woff,woff2}']`
- Kurzer Kommentar, **warum**: Die Nährwert-/Rezeptdaten liegen als JSON
  in `public/data/` und werden zur Laufzeit per `fetch` geladen. Ohne
  diesen Eintrag nimmt Workbox JSON nicht ins Manifest auf (Default-
  `globPatterns` kennt nur js/css/html/Bilder). Folge: nach einem
  Deployment mit geänderter `food-database.json` behält ein bestehender
  Client den alten Datenstand. Mit JSON im Manifest bekommt jede
  Datenänderung einen neuen Revision-Hash → neuer Service Worker →
  `autoUpdate` zieht die Daten nach.

### 5. Datenbank neu erzeugen
- `npm run convert:food-db` laufen lassen, damit die aktualisierte
  `public/data/food-database.json` (mit den eingemischten eigenen
  Produkten) im Commit ist — die Datei ist Teil des Repos, nicht nur ein
  lokales Build-Artefakt.

### 6. `README.md`
- Im Abschnitt "Datenquellen" bei der Schweizer Nährwertdatenbank einen
  Punkt ergänzen: eigene Markenprodukte stehen in
  `quellen/eigene-produkte.json`, diese Datei _ist_ im Repo (anders als
  die Rohdaten Dritter) und wird von `convert:food-db` in die
  `food-database.json` gemischt (gleiche `id` überschreibt, neue `id`
  wird angehängt).

---

## Was NICHT Teil dieses Auftrags ist
- Keine UI zum Erfassen/Bearbeiten eigener Produkte in der App — die
  Pflege läuft ausschliesslich über die JSON-Datei + `convert:food-db`.
- Kein zweiter Laufzeit-Datenpfad: die App liest weiterhin nur
  `public/data/food-database.json`, ihr ist egal, ob ein Eintrag generisch
  oder eigen ist.
- Kein vollständiger Schema-/Wertebereich-Validator für
  `eigene-produkte.json` — nur die grobe Pflichtfeldprüfung aus Punkt 3.
- Keine automatische Anreicherung fehlender Vitamin-/Mineralstoffwerte
  (bleiben `null`).
- Keine Änderung an der Spalten-Zuordnung/Logik für die generischen
  BLV-Einträge (`toFoodItem`).
- `schemaVersion` des Backups (Instruktion 10) bleibt unberührt — das
  Datenmodell `FoodItem` ändert sich nicht.

## Nach Abschluss
Bitte zeigen:
- `npm run convert:food-db` einmal **mit** und einmal **ohne**
  `quellen/eigene-produkte.json` (Datei kurz wegschieben) — im zweiten
  Fall läuft die Konvertierung normal durch, nur ohne die eigenen
  Einträge.
- In der erzeugten `food-database.json` die zwei `custom-…`-Einträge
  zeigen; einen Fall mit kollidierender `id` (eigener Eintrag ersetzt den
  generischen an gleicher Stelle) kurz demonstrieren oder beschreiben.
- Einen absichtlichen Tippfehler in `eigene-produkte.json` (z.B. `id`
  entfernt) → `convert:food-db` bricht mit `eigene-produkte.json[<i>]: …`
  ab, ohne eine halbfertige Ausgabedatei zu schreiben.
- Bestätigen, dass `npm run build` `dist/data/*.json` jetzt mit
  Revision-Hash ins `sw`-Precache-Manifest aufnimmt.
