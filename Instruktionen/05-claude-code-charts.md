# Instruktion 5: Chart-Darstellung Bedarf vs. Aufnahme

## Kontext
Aufbauend auf:
- `src/features/nutrient-requirements/` — Bedarf pro Profil
- `src/features/recipes/` — Aufnahme pro Rezept/Portion, inkl. der kürzlich
  ergänzten %-Bedarf-Spalte in der Detailansicht

Jetzt: die Zahlen, die bereits berechnet werden, zusätzlich **grafisch**
darstellen. Chart.js wird neu als Dependency eingeführt.

## Ziel
Auf der Rezept-Detailansicht (`recipeDetailView.ts`) soll neben/statt der
bestehenden Tabelle ein Chart erscheinen, das Bedarf (100%) vs. tatsächliche
Aufnahme durch dieses Rezept pro Nährstoff visualisiert.

---

## Aufgaben

### 1. Dependency einrichten
- `chart.js` installieren
- Prüfen: Tree-Shaking/Bundle-Grösse beachten — nur die benötigten Chart-Typen
  importieren (nicht das komplette Chart.js-Paket, falls es registrierbare
  Module gibt)

### 2. Chart-Komponente
`src/features/charts/nutrientComparisonChart.ts`:
- Nimmt als Input: berechnete Aufnahme (`NutrientValues`) + Bedarf
  (`NutrientRequirement[]`) für ein Profil
- Berechnet daraus die Prozentwerte (falls die Logik nicht schon aus der
  kürzlich ergänzten %-Spalte wiederverwendet werden kann — bitte dort
  nachschauen und die bestehende Berechnungsfunktion wiederverwenden statt
  duplizieren)
- Rendert ein **Radar-Chart** als Hauptdarstellung: ein Datenpunkt pro
  Nährstoff, Wert = % des Tagesbedarfs, mit einer Referenzlinie/-fläche bei 100%
- Zusätzlich (falls es zeitlich/sinnvoll reinpasst): Umschalt-Option auf ein
  **gruppiertes Balkendiagramm** (zwei Balken pro Nährstoff: Bedarf vs.
  Aufnahme in absoluten Werten inkl. Einheit) — das ist für Nährstoffe mit
  sehr unterschiedlichen Grössenordnungen (z.B. Protein in g vs. Vitamin B12
  in µg) teils aussagekräftiger als reine Prozentwerte in einem Chart

### 3. Nährstoff-Auswahl fürs Chart
- Nicht alle je erfassten Nährstoffe gleichzeitig in einem Radar-Chart
  darstellen (wird unlesbar) — auf eine sinnvolle Kernauswahl beschränken,
  z.B. die Makronährstoffe (Protein, Fett, Kohlenhydrate, Ballaststoffe) plus
  2-3 Mikronährstoffe, für die tatsächlich Daten vorhanden sind
- Nährstoffe mit `incomplete: true` (siehe Instruktion 4, fehlende
  Datenbankwerte) klar kennzeichnen oder aus dem Chart ausschliessen, statt
  sie als 0% darzustellen — das würde fachlich falsche Werte suggerieren

### 4. Einbindung in die UI
- Chart in `recipeDetailView.ts` einbinden, oberhalb oder statt der reinen
  Tabelle (Tabelle kann als Detailansicht "darunter" bestehen bleiben, für
  Nutzer:innen, die genaue Zahlen sehen wollen — Chart für den schnellen
  visuellen Überblick)
- Responsive: Chart muss auf iPhone-Breite (kleinster Zielbildschirm) noch
  lesbar sein — bei Bedarf Legende/Beschriftung kompakter darstellen auf
  schmalen Viewports

### 5. Konsistentes Styling
- Farbschema an bestehende CSS-Variablen anlehnen (aus dem Grundsetup),
  nicht Chart.js-Standardfarben unverändert übernehmen
- Eine Farbe klar für "Bedarf/100%-Linie", eine andere für "Aufnahme" — über
  das ganze Chart-Feature hinweg konsistent verwenden (falls später weitere
  Chart-Typen dazukommen)

### 6. Wiederverwendbarkeit im Hinterkopf behalten
- Chart-Komponente so schreiben, dass sie nicht zwingend an "ein Rezept"
  gebunden ist, sondern generisch "Aufnahme vs. Bedarf" für beliebige
  `NutrientValues` entgegennimmt — falls später (Tages-Tracking oder
  mehrere Rezepte kombiniert) derselbe Chart-Typ wiederverwendet werden soll

---

## Was NICHT Teil dieses Auftrags ist
- Kein Tages-Tracking / keine Aggregation über mehrere Mahlzeiten
- Keine Chart-Konfiguration durch Nutzer:innen (z.B. eigene Nährstoffauswahl) —
  feste, sinnvoll vorausgewählte Nährstoffe reichen für jetzt
- Keine Export-/Screenshot-Funktion für Charts

## Nach Abschluss
Bitte zeigen:
- Screenshot oder Beschreibung des Radar-Charts mit einem Beispielrezept
- Kurz bestätigen, welche Nährstoffe für die Chart-Kernauswahl verwendet wurden
  und warum (Datenverfügbarkeit vs. fachliche Relevanz)
