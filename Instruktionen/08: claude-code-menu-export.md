# Instruktion 8: JSON-Export eigener Menüs (Merge in recipes.json)

## Kontext
Aufbauend auf:
- `src/features/recipes/recipeService.ts` — liest `public/data/recipes.json`
- `src/features/menu-builder/` — eigene Menüs, aktuell nur in IndexedDB
  gespeichert (Instruktion 6)

Ziel: Ein in IndexedDB gespeichertes, eigenes Menü soll als zusätzlicher
Eintrag in die bestehende `recipes.json`-Struktur eingefügt und als **Datei
zum Download** bereitgestellt werden. Diese heruntergeladene Datei kann dann
manuell `public/data/recipes.json` im Projekt ersetzen und per Git committet
werden — damit wird aus einem "eigenen Menü" dauerhaft ein festes Rezept im
Projekt.

**Wichtiger Punkt zur Erwartungshaltung**: Der Browser kann keine Git-Befehle
ausführen oder Dateien im Repo verändern. Das Feature erzeugt einen
**Download** der aktualisierten JSON-Datei — das manuelle Ersetzen der Datei
im Projekt und der `git commit`/`git push` bleiben ein manueller Schritt
ausserhalb der App. Bitte das auch so in der UI kommunizieren (kein
Missverständnis erzeugen, als würde die App "automatisch hochladen").

---

## Aufgaben

### 1. Konvertierung Menu → Recipe
`src/features/menu-builder/menuExportService.ts`:
- Funktion `menuToRecipe(menu: Menu, servings: number): Recipe`
  - übernimmt `name`, `ingredients` unverändert
  - `servings` kommt vom Nutzer (siehe Punkt 2 — nicht einfach 1 annehmen,
    da ein Menü durchaus für mehrere Portionen gedacht sein kann)
  - `instructions` optional leer lassen (kann Nutzer:in später manuell in
    der JSON-Datei ergänzen, das ist nicht Teil dieses Features)
  - **ID-Vergabe**: neue, kollisionsfreie ID erzeugen — z.B. Slug aus dem
    Menü-Namen + kurzer Hash/Timestamp-Suffix. Vor dem Export gegen alle
    bestehenden IDs aus der aktuell geladenen `recipes.json` prüfen; bei
    Kollision Suffix anpassen, bis eindeutig

### 2. Export-UI
In `menuDetailView.ts` (bzw. `menuListView.ts`, wo es besser passt) einen
**"Als Rezept exportieren"**-Button ergänzen:
- Bei Klick: kurze Eingabe "Wie viele Portionen ergibt dieses Menü?"
  (Zahl, sinnvoller Default z.B. 1, mit Validierung > 0) — einfacher Prompt
  oder kleines Inline-Formular reicht, kein grosser Dialog nötig
- Danach:
  1. Aktuelle `recipes.json` laden (über bestehenden `recipeService`, bzw.
     roh per `fetch`, falls der Service nicht das volle Array zurückgibt)
  2. Menü via `menuToRecipe()` in ein `Recipe`-Objekt umwandeln
  3. An das bestehende Array anhängen
  4. Resultierendes Array als JSON-Datei zum Download anbieten (Blob +
     `<a download>`), Dateiname z.B. `recipes-updated.json` (**bewusst
     nicht** `recipes.json` nennen, damit nicht versehentlich unbemerkt die
     bestehende Projektdatei im Download-Ordner überschrieben wird, ohne
     dass die Nutzerin es merkt)
  5. Kurzer Hinweistext direkt bei/nach dem Download sichtbar:
     „Datei heruntergeladen. Um sie zu übernehmen: `recipes-updated.json`
     nach `public/data/recipes.json` verschieben/umbenennen und im Projekt
     committen."

### 3. Validierung vor Export
- Menü muss mindestens eine Zutat haben (sollte durch Instruktion 6 ohnehin
  schon sichergestellt sein, hier trotzdem defensiv prüfen)
- Falls das Laden der aktuellen `recipes.json` fehlschlägt (z.B. Netzwerk-
  problem beim Fetch): klare Fehlermeldung statt eines kaputten/leeren
  Exports

### 4. Kein Zurückschreiben in IndexedDB nötig
- Das exportierte Menü bleibt zusätzlich in IndexedDB gespeichert
  (unverändert) — der Export ist rein additiv/lesend, kein "Verschieben"
  mit Löschen aus IndexedDB. Falls das gewünscht wäre (Menü nach Export aus
  den "eigenen Menüs" entfernen), bitte nicht automatisch machen, sondern
  höchstens als separate, klar beschriftete Option anbieten

### 5. Tests
- Unit-Test für `menuToRecipe`: korrekte Struktur, keine doppelten IDs bei
  wiederholtem Aufruf mit gleichem Menü-Namen
- Unit-Test/-Check: exportiertes JSON ist valides, parsbares JSON und
  entspricht dem bestehenden `Recipe[]`-Schema (z.B. gegen die bestehenden
  Typen validieren)

---

## Was NICHT Teil dieses Auftrags ist
- Keine echte Git-Integration (kein automatisches Commit/Push aus dem
  Browser — technisch mit reinem Frontend ohnehin nicht sinnvoll umsetzbar)
- Kein Export mehrerer Menüs gleichzeitig (kann später ergänzt werden, falls
  gewünscht)
- Keine Bearbeitung des Menüs vor dem Export (Name/Zutaten bleiben wie
  gespeichert, nur Portionenzahl wird zusätzlich abgefragt)

## Nach Abschluss
Bitte zeigen:
- Ablauf einmal durchgespielt: Menü exportieren → resultierende
  `recipes-updated.json` (Auszug: neuer Eintrag) zeigen
- Kurz bestätigen, dass die ID-Kollisionsprüfung tatsächlich greift (z.B.
  Test mit zwei Menüs mit identischem Namen)
