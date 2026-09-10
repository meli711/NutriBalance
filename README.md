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

## Nächste Schritte

- Weitere Mikronährstoffe in den Referenzwerten ergänzen
- Deployment (siehe `npm run build:nutribalance-subpath` für Unterordner-Hosting)
