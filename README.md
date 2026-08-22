# NutriBalance

Matura-Arbeit von Meliane Sterchi: Nährstoffbedarf vs. Nährstoffaufnahme,
inkl. Rezept-Feature. Reines Frontend-Projekt, installierbar als PWA auf
macOS, iPad/iPhone und Desktop-Browsern.

> Dieser Stand ist reines Projekt-Setup (Build-Pipeline, Ordnerstruktur,
> Storage-Grundgerüst). Es sind noch keine Features, keine UI und keine
> Nährwertdaten eingebunden.

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

## Nächste Schritte

- Schweizer Nährwertdatenbank als lokale JSON-Datei einbinden
- UI-Komponenten für Bedarf/Aufnahme/Rezepte umsetzen
- Chart.js für Visualisierungen integrieren
- Deployment (Vercel/GitHub Pages)
