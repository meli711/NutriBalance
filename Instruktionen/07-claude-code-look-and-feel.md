# Instruktion 7: Look & Feel — Branding, Design-Pass, Bilder

## Kontext
Funktional ist die App weitgehend fertig (Profil, Bedarf, Rezepte, Charts,
Menü-Builder). Diese Instruktion ist ein **reiner Design-/Branding-Pass** —
keine neue Funktionalität, keine Änderung an Datenmodellen oder Logik.

## Ziel
- App-Name **"Meliane's NutriBalance"** sichtbar auf der Seite (Header/Logo-
  Bereich)
- Hinweis auf **Matura-Arbeit 2026, Kantonsschule Zofingen** sichtbar
  (Footer oder eigener kurzer "Über"-Bereich — bitte kurz nachfragen/selbst
  entscheiden, was besser passt)
- Eigenständiges, durchdachtes visuelles Erscheinungsbild statt
  Standard-Bootstrap-Look — die App soll nicht wie eine generische
  KI-generierte Vorlage aussehen, sondern eine bewusste, zum Thema passende
  Gestaltung haben
- Ein paar passende Bilder, die die App auflockern (siehe Abschnitt "Bilder"
  unten — bitte sorgfältig lesen wegen Bildrechten)

---

## Design-Vorgehen (bitte in dieser Reihenfolge)

### 1. Design-Plan zuerst, dann Umsetzung
Bevor Code geändert wird: kurzen Design-Plan festlegen (kann als Kommentar
in einer Notiz-Datei `DESIGN.md` im Projekt festgehalten werden, damit
nachvollziehbar ist, warum welche Entscheidung getroffen wurde — das lässt
sich auch für den Methodik-/Reflexionsteil der Matura-Arbeit verwenden):
- **Farbpalette**: 4–6 konkrete Hex-Werte, thematisch zu Ernährung/Balance
  passend — bitte NICHT die typischen "KI-Design"-Defaults verwenden
  (warmes Creme-Beige mit Terracotta-Akzent; fast-schwarzer Hintergrund mit
  grellem Neongrün/Vermillon-Akzent; reines Zeitungslayout mit Haarlinien).
  Stattdessen etwas, das zum Thema "Nährstoff-Balance" passt — z.B. von
  frischen, natürlichen Lebensmittelfarben inspiriert (nicht wörtlich
  "Gemüsegrün", sondern eine durchdachte, eigenständige Palette)
- **Typografie**: eine Display-Schrift mit Charakter (zurückhaltend
  eingesetzt, z.B. für den App-Namen/Überschriften) + eine gut lesbare
  Fliesstext-Schrift, klare Grössen-/Gewichts-Hierarchie. Beide über
  Google Fonts oder ähnlich frei einbindbar (Lizenz beachten — kostenlos für
  diesen Zweck)
- **Layout-Konzept**: kurz beschreiben, wie sich Header (Name/Branding),
  Content-Bereich und Footer (Matura-Arbeit-Hinweis) zueinander verhalten,
  konsistent über alle bestehenden Screens hinweg
- **Signatur-Element**: ein wiederkehrendes visuelles Element, das die App
  einprägsam macht — z.B. eine spezifische Darstellungsart für die
  Bedarfs-Charts, ein wiederkehrendes Icon-/Illustrationsstil, oder ein
  charakteristisches Detail im Header. Ein Element reicht, lieber das eine
  gut durchdacht als mehrere halbherzige

### 2. Umsetzung
- Design-Tokens (Farben, Fonts, Spacing) zentral als CSS-Variablen pflegen
  (bestehende Variablen aus dem Grundsetup als Basis nehmen und verfeinern,
  nicht komplett neu erfinden)
- Konsistent über **alle** bestehenden Screens anwenden: Profil-Formular,
  Bedarfs-Anzeige, Rezeptliste/-detail, Menü-Builder, Charts
- Header mit "Meliane's NutriBalance"-Branding auf allen Screens sichtbar
  (z.B. fixe/simple Kopfzeile)
- Footer mit Matura-Arbeit-Hinweis ("Matura-Arbeit 2026, Kantonsschule
  Zofingen" oder passender Formulierung) auf allen Screens
- Charts (Instruktion 5) an die neue Farbpalette anpassen, nicht die
  Chart.js-Default-Farben belassen

### 3. Qualitäts-Grundlagen nicht vergessen
- Responsive bis auf iPhone-Breite geprüft (Ziel-Geräte: Mac/iPad/iPhone,
  siehe Grundsetup)
- Sichtbarer Fokus-Zustand bei Tastaturnavigation (Accessibility)
- Farbkontraste ausreichend lesbar (nicht nur hübsch, auch nutzbar)
- Zurückhaltung bei Animationen — wenn welche eingesetzt werden, gezielt
  (z.B. sanfter Übergang beim Screen-Wechsel), nicht überall gleichzeitig

---

## Bilder — bitte sorgfältig, wegen Bildrechten

Für eine Matura-Arbeit ist es wichtig, dass verwendete Bilder entweder
**selbst erstellt** oder **nachweislich frei lizenziert** sind — das gehört
in einer schulischen Arbeit zur sauberen Quellenarbeit.

Empfehlung, in dieser Reihenfolge:
1. **Eigene Fotos** (z.B. von Meliane selbst fotografierte Lebensmittel/
   Gerichte) — am besten für Originalität und Bildrechte, aber das kann
   Claude Code nicht für dich erledigen. Falls das eine Option ist, bitte
   einen Ordner `public/images/` vorbereiten, in den du eigene Fotos später
   einfach reinlegen kannst, mit sinnvoller Benennung
2. **Frei lizenzierte Stockfotos** (z.B. Unsplash, Pexels — beide bieten
   kostenlose, für diesen Zweck nutzbare Bilder ohne Attributionspflicht,
   aber Lizenzbedingungen im Zweifel selbst nochmal prüfen). Claude Code
   soll hier NICHT eigenständig Bilder von beliebigen Webseiten
   herunterladen oder Platzhalter-URLs erfinden — falls Unsplash/Pexels
   eingebunden werden, bitte mit nachvollziehbarer Quellenangabe (Dateiname
   oder Kommentar mit Bildquelle/Fotograf, falls die Lizenz das verlangt)
3. **Einfache eigene Illustrationen/Icons** (z.B. simple SVGs für
   Nährstoff-Kategorien) sind eine gute Alternative zu Fotos — geringeres
   Rechterisiko, passt oft besser zum reduzierten Design-Ansatz, und lässt
   sich leicht in der Farbpalette der App halten

- Bilder wo sinnvoll einsetzen: z.B. Header-Bereich, evtl. bei
  Rezept-Karten in der Liste (falls das nicht zu aufwändig wird), keinesfalls
  wahllos überall reinstopfen — jedes Bild soll einen Zweck haben (siehe
  Design-Prinzip oben: Elemente sollen etwas Wahres/Sinnvolles zum Inhalt
  beitragen, nicht nur dekorieren)
- Bildgrössen für PWA-Performance optimieren (komprimiert, sinnvolle
  Auflösung — keine unnötig grossen Dateien, die App soll auch auf Mobile
  schnell laden)
- Alt-Texte für alle Bilder setzen (Accessibility + gute Praxis)

---

## Was NICHT Teil dieses Auftrags ist
- Keine neuen Features/Screens
- Keine Änderung an Datenmodellen, Storage-Logik oder Berechnungen
- Kein Download beliebiger Bilder von Google-Bildersuche o.ä. ohne
  nachvollziehbare Lizenz

## Nach Abschluss
Bitte zeigen:
- Kurzer Auszug aus `DESIGN.md` (Farbpalette, Typografie-Wahl, Signatur-
  Element) mit kurzer Begründung, warum das zum Thema passt
- Screenshot oder Beschreibung von mind. 2 Screens im neuen Look
- Übersicht, welche Bilder verwendet wurden und woher (Platzhalter für
  eigene Fotos vs. lizenzierte Stockfotos vs. Illustrationen)
