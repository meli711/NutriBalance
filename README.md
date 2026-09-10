# NutriBalance

Matura-Arbeit von Meliane Sterchi: Nährstoffbedarf vs. Nährstoffaufnahme,
inkl. Rezept-Feature. Reines Frontend-Projekt, installierbar als PWA auf
macOS, iPad/iPhone und Desktop-Browsern.

## Setup

```bash
npm install
```


## Entwicklung

```bash
npm run dev
```

Startet den Vite-Dev-Server mit Hot Module Reload unter http://localhost:5173.

## Build

```bash
npm run build
```

Erstellt einen produktionsfähigen Build in `dist/` (inkl. PWA-Manifest und
Service Worker via `vite-plugin-pwa`).

## Build lokal testen

```bash
npm run preview
```

## Linting & Formatierung

```bash
npm run lint
npm run format
```

## Tech-Stack-Entscheidungen

- **Vite statt Webpack**: schnellerer Dev-Server (native ESM, HMR), einfachere
  Konfiguration, eingebauter TypeScript-Support und ein ausgereiftes
  PWA-Plugin (`vite-plugin-pwa`).
- **Vanilla TypeScript statt Framework** (kein React/Vue/Svelte): bewusst
  einfach gehalten, damit sich die Architektur in der schriftlichen Arbeit
  gut erklären lässt. Modularer Aufbau über TS-Module/Klassen.
- **PWA** (Web App Manifest + Service Worker): ermöglicht Installation auf
  macOS, iPad/iPhone ("Zum Home-Bildschirm hinzufügen") und Desktop-Browsern
  ohne App-Store.
- **`localStorage`** für einfache Key-Value-Daten (Alter, Grösse, Geschlecht,
  ausgewählte Nährstoffe), **`IndexedDB`** (via `idb`) für strukturierte,
  grössere Daten (z. B. Rezepte, Verlauf). Kein Cookie-basierter Storage.
- **Chart.js** ist als spätere Dependency vorgesehen (noch nicht integriert).

## Projektstruktur

```
src/
  app/            App-Einstiegspunkt, Routing/Views
  data/           Datenmodelle, Storage-Zugriff (localStorage/IndexedDB)
  features/       spätere Feature-Module (Bedarf, Aufnahme, Rezepte)
  styles/         CSS
  utils/
public/
  icons/          PWA-Icons (aktuell Platzhalter)
```

## Datenquellen (Rohdaten nicht im Repo)

Die App nutzt Daten Dritter, die für dieses Repo konvertiert bzw. als
Referenz verwendet, aber **nicht selbst veröffentlicht** werden (die
Rohdaten gehören nicht diesem Projekt). Der Ordner `quellen/` ist deshalb
in `.gitignore` und lokal nachzubauen:

1. **Schweizer Nährwertdatenbank** (Basis für `public/data/food-database.json`)
   - Quelle: [naehrwertdaten.ch](https://naehrwertdaten.ch/) (Bundesamt für
     Lebensmittelsicherheit und Veterinärwesen BLV), Excel-Export
     "Generische Lebensmittel" (in diesem Projekt verwendet: V 7.1)
   - Ablegen unter `quellen/Schweizer_Nahrwertdatenbank.xlsx`, danach:
     ```bash
     npm run convert:food-db
     ```
     Details zur Spalten-Zuordnung: `scripts/convert-food-db.ts`.
   - Eigene Markenprodukte, die es in der generischen BLV-Datenbank nicht
     gibt, stehen in `quellen/Meliane-Produkte.json` (JSON-Array von
     `FoodItem`-Objekten, Werte pro 100 g). Diese Datei _ist_ im Repo (im
     Gegensatz zu den Rohdaten Dritter) und wird von `convert:food-db` in die
     `food-database.json` gemischt: gleiche `id` überschreibt den generischen
     Eintrag, neue `id` wird angehängt.

2. **DACH-Referenzwerte** (Basis für die Bedarfswerte in
   `src/features/nutrient-requirements/data/referenceValues.ts`)
   - Quelle: [DGE – Referenzwerte für die Nährstoffzufuhr](https://www.dge.de/wissenschaft/referenzwerte/)
     (Deutsche Gesellschaft für Ernährung; dieselben Werte werden von der
     SGE für die Schweiz übernommen, [sge-ssn.ch](https://www.sge-ssn.ch/))
   - Konkret verwendete Unterseiten: `energie`, `protein`,
     `fett-essenzielle-fettsaeuren`, `kohlenhydrate`, `ballaststoffe`,
     `calcium`, `eisen`, `vitamin-c`
   - Für die schriftliche Arbeit wurden lokale HTML-Snapshots dieser Seiten
     archiviert (Stand siehe `source`-Angaben in `referenceValues.ts`) —
     ebenfalls nicht im Repo, da fremder Seiteninhalt.

## Instruktionen (Entwicklungsverlauf)

Die App wurde schrittweise mit Claude Code umgesetzt. Jeder Schritt ist als
Auftrag in `Instruktionen/` dokumentiert (Kontext, Aufgaben, Abgrenzung) und
entspricht grob einem Commit `Instruktion N: …`.

| # | Thema | Datei |
|---|-------|-------|
| 1 | Projekt-Setup: Vite + TypeScript (strict) + PWA-Grundgerüst | [`01-claude-code-setup-instruktion.md`](Instruktionen/01-claude-code-setup-instruktion.md) |
| 2 | Schweizer Nährwertdatenbank einbinden + Feature-Modul "Nährstoffbedarf" (DACH-Referenzwerte) | [`02-claude-code-datenbank-bedarf.md`](Instruktionen/02-claude-code-datenbank-bedarf.md) |
| 3 | UI für die Profil-Eingabe (Alter, Grösse, Geschlecht …) + Anzeige des berechneten Bedarfs | [`03-claude-code-profil-ui.md`](Instruktionen/03-claude-code-profil-ui.md) |
| 4 | Aufnahme-Feature: Rezepte mit Zutaten, Nährstoffberechnung pro Portion | [`04-claude-code-rezepte.md`](Instruktionen/04-claude-code-rezepte.md) |
| 5 | Charts: Bedarf vs. Aufnahme als Radar- und Balkendiagramm (Chart.js) | [`05-claude-code-charts.md`](Instruktionen/05-claude-code-charts.md) |
| 6 | Menü-Builder: eigene Menüs aus Zutaten zusammenstellen, Ablage in IndexedDB | [`06-claude-code-menu-builder.md`](Instruktionen/06-claude-code-menu-builder.md) |
| 7 | Look & Feel: Branding, Design-Pass, Bildsprache (Detail-Plan in `DESIGN.md`) | [`07-claude-code-look-and-feel.md`](Instruktionen/07-claude-code-look-and-feel.md) |
| 8 | JSON-Export eigener Menüs, Merge zurück in `recipes.json` | [`08-claude-code-menu-export.md`](Instruktionen/08-claude-code-menu-export.md) |
| 9 | Tages-Log: Rezepte / Menüs / einzelne Zutaten pro Tag erfassen, neuer Startbildschirm | [`09-claude-code-tages-log.md`](Instruktionen/09-claude-code-tages-log.md) |
| 10 | Daten-Backup (Export/Import als eine Datei) auf der Profilseite, Storage-Persistenz | [`10-claude-code-backup.md`](Instruktionen/10-claude-code-backup.md) |
| 11 | Verlauf: Wochen-/Monatsübersicht der Aufnahme pro Nährstoff mit Bedarfs-Linie | [`11-claude-code-verlauf.md`](Instruktionen/11-claude-code-verlauf.md) |
| 12 | Eigene Markenprodukte in `quellen/Meliane-Produkte.json` in die Lebensmitteldatenbank mischen; JSON ins PWA-Precache | [`12-claude-code-eigene-produkte.md`](Instruktionen/12-claude-code-eigene-produkte.md) |

Ergänzend: [`DESIGN.md`](Instruktionen/DESIGN.md) — Design-Plan zu Instruktion 7
(Farbpalette, Typografie, Bildsprache, konkrete UI-Anpassungen).

## Nächste Schritte

- Weitere Mikronährstoffe in den Referenzwerten ergänzen
- Deployment (siehe `npm run build:nutribalance-subpath` für Unterordner-Hosting)
