# Design-Plan — Instruktion 7 (Look & Feel)

Festgehalten _vor_ der Umsetzung, wie von der Instruktion verlangt — damit
nachvollziehbar ist, warum welche Entscheidung getroffen wurde (auch für den
Methodik-/Reflexionsteil der Matura-Arbeit nutzbar).

## Leitidee

Der App-Name ist Programm: **Balance** zwischen Bedarf und Aufnahme ist das
zentrale Konzept der ganzen App (Instruktion 2–5). Statt einer Deko-Palette
wird genau diese Dualität zum durchgehenden visuellen Prinzip: **zwei
gegenüberstehende Farbfamilien** (ein tiefes Grün für "Aufnahme", ein warmes
Amber für "Bedarf"), die sich durch Header, Buttons, Charts und das
Signatur-Element ziehen — nicht als beliebige Zufallsfarben, sondern als
Träger der inhaltlichen Aussage der App.

Bewusst vermieden (siehe Instruktion): warmes Creme-Beige+Terracotta,
fast-schwarz+Neongrün, reines Zeitungslayout mit Haarlinien.

## Farbpalette

| Rolle                       | Hex                   | Beschreibung                                                                   |
| --------------------------- | --------------------- | ------------------------------------------------------------------------------ |
| Ink (Text)                  | `#1c2321`             | warmes Fast-Schwarz, kein reines `#000`                                        |
| Paper (Hintergrund)         | `#f5f7f2`             | sehr helles, kühl-warmes Neutral mit Hauch Salbei — bewusst _kein_ Creme-Beige |
| Deep Balance-Green (Primär) | `#1f5f5b`             | gedeckter Tannen-Teal, Header/Primär-Buttons — steht für "Aufnahme"            |
| Warm Balance-Amber (Akzent) | `#b5651d`             | erdiges Kurkuma/Ocker, nicht Terracotta-orange — steht für "Bedarf"            |
| Muted Plum (Tertiär)        | `#6b4a63`             | gedämpftes Beeren-Violett, sparsam für Warnhinweise/Zusatzakzente              |
| Border/Muted                | `#d8dbd0` / `#5b5d54` | von der Paper-Farbe abgeleitet, nicht neutrales Grau                           |

Grün/Amber sind für Diagramm-Datenpunkte in einer saturierteren Variante
hinterlegt (`--chart-color-*`), da die gedeckten UI-Töne für dünne
Chart-Linien zu entsättigt wirken (mit dem `dataviz`-Skill-Validator
geprüft: Chroma-Floor, CVD-Trennung ΔE 10.1, Kontrast — alle Checks
bestanden). Kontrastwerte gegen Paper/Weiss wurden für alle
text-tragenden Kombinationen auf WCAG AA (≥4.5:1 für Fliesstext, ≥3:1 für
grosse/Icon-Elemente) geprüft.

## Typografie

- **Display (Wortmarke/Überschriften)**: [Fraunces](https://fonts.google.com/specimen/Fraunces) —
  eine Serifenschrift mit "wonky" Optical-Size-Charakter, wirkt organisch/
  warm statt generisch-corporate. Passt zum Thema "Nahrung" besser als eine
  geometrische Grotesk. Zurückhaltend eingesetzt: nur App-Name + `<h1>`.
- **Fliesstext**: [Work Sans](https://fonts.google.com/specimen/Work+Sans) —
  gut lesbare humanistische Sans-Serif, bewusst _nicht_ Inter (mittlerweile
  selbst zum "KI-Standard" geworden). Beide Schriften sind über Google Fonts
  kostenlos unter der SIL Open Font License nutzbar.

## Layout-Konzept

Persistenter App-Rahmen (`appShell.ts`) auf allen Screens:

- **Header**: dunkelgrüner Balken, Signatur-Mark + Wortmarke "Meliane's
  NutriBalance" (Fraunces). Immer sichtbar, keine Navigation darin (Screens
  behalten ihre eigenen Zurück-Buttons).
- **Content**: einzelner `<main id="screen-content">` — die bestehenden
  Screens rendern direkt hinein (kein eigenes verschachteltes `<main>` mehr).
- **Footer**: schmal, Matura-Arbeit-Hinweis ("Matura-Arbeit 2026 ·
  Kantonsschule Zofingen"), gedeckte Farben, kein visuelles Gewicht.

Entscheidung Footer vs. eigener "Über"-Bereich: **Footer**, da der Hinweis
kurz ist und ohnehin auf jedem Screen sichtbar sein soll — ein eigener
Screen wäre ein zusätzlicher Navigationspunkt für eine reine Meta-Info und
stünde im Widerspruch zu "keine neuen Screens" (siehe "Was nicht Teil ist").

## Signatur-Element

Ein zweifarbiges, abstraktes **"Balance-Mark"**: zwei einander zugewandte,
blattartige Tropfenformen (Grün + Amber), die sich in der Mitte berühren —
visualisiert wörtlich die Kernidee "zwei Grössen im Gleichgewicht". Erscheint
klein im Header (neben der Wortmarke) und nochmals reduziert/gedämpft im
Footer. Bewusst _ein_ Element statt mehrerer verschiedener Icons — siehe
Prinzip "lieber ein Element gut durchdacht".

## Bilder — Herkunft & Entscheidung

1. **Eigene Fotos**: Ordner `../public/images` ist vorbereitet — Meliane kann
   eigene Foodfotos dort ablegen (sinnvolle Dateinamen, siehe
   `../public/images/README.md`).
2. **Ein verifiziertes Stockfoto**: `../public/images/header-balanced-meals.jpg`,
   Foto von **Shayda Torabi** auf Unsplash
   (https://unsplash.com/photos/3iexvMShGfQ), Unsplash-Lizenz (kostenlos,
   keine Attribution nötig, aber als `<figcaption>` unter dem Bild trotzdem
   als gute Praxis genannt). Bewusst nur **ein** Foto, gezielt auf dem zentralen
   "Dein Nährstoffbedarf"-Screen platziert — nicht auf jedem Screen wahllos
   wiederholt.
3. **Rezeptlisten-Bilder**: bewusst **keine** Fotos pro Rezept (wäre 8 einzeln
   zu recherchierende/verifizierende Lizenzen für einen "evtl."-Punkt der
   Instruktion) — stattdessen kleine, selbst gezeichnete SVG-Kategorie-Icons
   (Frühstück/Hauptmahlzeit/Snack), passend zur reduzierten Formsprache,
   ohne jedes Rechterisiko.

## Bewegung

Ein einzelner, dezenter Übergang: sanftes Fade+Slide-up (200ms) beim
Screen-Wechsel im Content-Bereich, respektiert `prefers-reduced-motion`.
Keine weiteren Animationen (Buttons, Charts bleiben wie sie sind).
