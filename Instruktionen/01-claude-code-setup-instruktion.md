# Projekt-Setup: Nährstoff-Webapp (Matura-Arbeit) von Meliane Sterchi

## Kontext
Dies ist eine Matura-Arbeit von Meliane über Nährstoffbedarf vs. Nährstoffaufnahme,
inkl. Rezept-Feature. Reines Frontend-Projekt ohne eigenes Backend/Datenbank.
Datenquelle (Schweizer Nährwertdatenbank) wird später als lokale JSON-Datei eingebunden,
das ist NICHT Teil dieses Setup-Schritts.

**Dieser Auftrag umfasst NUR das Projekt-Setup inkl. Build-Pipeline — noch keine
Features, keine UI, keine Daten.**

## Ziel-Plattformen
Die App muss als installierbare Web-App laufen auf:
- macOS (Safari/Chrome, sowie als installierte PWA)
- iPad / iPhone (Safari, "Zum Home-Bildschirm hinzufügen")
- Desktop-Browser generell

→ Das bedeutet: **PWA-fähig** (Web App Manifest + Service Worker), responsive Design
(mobile-first), kein Feature, das auf Desktop-only APIs angewiesen ist.

## Tech-Stack (bitte so umsetzen)
- **Build-Tool: Vite** (nicht Webpack) — deutlich schnellere Dev-Experience,
  einfachere Konfiguration, eingebauter TypeScript-Support, gutes PWA-Plugin.
  Falls es einen guten Grund gibt, stattdessen Webpack zu nehmen, kurz begründen
  statt einfach umzusetzen.
- **Sprache:** TypeScript (strict mode aktiviert)
- **UI:** Vanilla TypeScript + HTML + CSS (kein React/Vue/Svelte) — bewusst
  einfach gehalten, damit sich die Architektur in der schriftlichen Arbeit
  gut erklären lässt. Modularer Aufbau über TS-Module/Klassen, kein Framework-Overhead.
- **Speicherung:**
  - `localStorage` für einfache Key-Value-Daten (Alter, Grösse, Geschlecht,
    ausgewählte Nährstoffe/Ziele)
  - `IndexedDB` (über einen schlanken Wrapper wie `idb`) für strukturiertere/
    grössere Daten (z.B. gespeicherte Rezepte, Verlauf)
  - Kein Cookie-basierter Storage
- **Charts:** Chart.js einplanen (noch nicht integrieren, nur als Dependency-Ziel
  im Hinterkopf behalten für später)
- **PWA:** `vite-plugin-pwa` für Manifest + Service Worker + Icons

## Aufgaben für dieses Setup

1. **Projekt initialisieren**
   - Vite-Projekt mit TypeScript-Template aufsetzen (`npm create vite@latest`
     mit `vanilla-ts` Template als Basis)
   - Node-Version/Package Manager: npm verwenden, `package.json` sauber benennen
     (z.B. `nutribalance` o.ä. — Projektname bitte kurz nachfragen falls nicht klar)

2. **Ordnerstruktur anlegen**
   ```
   src/
     app/            # App-Einstiegspunkt, Routing/Views
     data/           # Datenmodelle, Storage-Zugriff (localStorage/IndexedDB)
     features/       # spätere Feature-Module (Bedarf, Aufnahme, Rezepte)
     styles/         # CSS
     utils/
   public/
     icons/          # PWA-Icons (Platzhalter reicht vorerst)
   ```

3. **TypeScript konfigurieren**
   - `tsconfig.json` mit `strict: true`, sinnvollen `target`/`lib` für moderne
     Browser (ES2020+)

4. **PWA-Setup**
   - `vite-plugin-pwa` installieren und konfigurieren
   - `manifest.json` mit App-Name, Icons (Platzhalter-Icons generieren oder
     einfache SVG/PNG-Dummies anlegen), `theme_color`, `display: standalone`
   - Sicherstellen, dass Apple-spezifische Meta-Tags gesetzt sind
     (`apple-touch-icon`, `apple-mobile-web-app-capable`) für sauberes
     "Zum Home-Bildschirm hinzufügen" auf iOS/iPadOS

5. **Responsive Grundgerüst**
   - Basis-HTML/CSS mit Viewport-Meta-Tag, mobile-first Grundlayout
     (Flexbox/Grid), CSS-Variablen für Farben/Spacing als Grundlage für später

6. **Storage-Layer vorbereiten (nur Grundgerüst, keine Business-Logik)**
   - `src/data/localStorageService.ts`: typisierte Get/Set-Helper für einfache
     User-Daten (Interface für "UserProfile" mit Alter, Grösse, Geschlecht,
     ausgewählte Nährstoffe — als Platzhalter-Typ)
   - `src/data/indexedDbService.ts`: Setup mit `idb`, leere Grundstruktur für
     spätere Object Stores (z.B. `recipes`)

7. **Tooling**
   - ESLint + Prettier mit sinnvoller Standard-Konfiguration für TypeScript
   - `.gitignore` (node_modules, dist, .DS_Store etc.)
   - Git-Repo initialisieren, ersten Commit erstellen

8. **Build & Dev-Skripte prüfen**
   - `npm run dev` → lokaler Dev-Server läuft
   - `npm run build` → produktionsfähiger Build in `dist/`
   - `npm run preview` → Build lokal testen
   - Kurz verifizieren, dass der Build fehlerfrei durchläuft

9. **README.md**
   - Kurze Setup-Anleitung (Installation, Dev-Server starten, Build)
   - Hinweis auf Tech-Stack-Entscheidungen (Vite statt Webpack, vanilla TS
     statt Framework, PWA für Cross-Device-Nutzung)

## Was NICHT Teil dieses Auftrags ist
- Keine Anbindung der Nährwertdatenbank
- Keine UI-Komponenten für Bedarf/Aufnahme/Rezepte
- Keine Chart-Integration
- Kein Deployment (Vercel/GitHub Pages folgt später)

## Nach Abschluss
Bitte kurz zusammenfassen: welche Entscheidungen getroffen wurden (falls von
obigen Vorgaben abgewichen wurde und warum), und was der nächste sinnvolle
Schritt wäre.
