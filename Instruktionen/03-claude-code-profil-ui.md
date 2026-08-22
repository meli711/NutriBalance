# Instruktion 3: UI für Profil-Eingabe + Anzeige des berechneten Bedarfs

## Kontext
Aufbauend auf dem bestehenden Setup:
- `src/data/localStorageService.ts` (aus Instruktion 1) für einfache Key-Value-Daten
- `src/features/nutrient-requirements/requirementService.ts` (aus Instruktion 2)
  für die Bedarfsberechnung

Jetzt: erste sichtbare UI. Nutzer:in gibt einmalig Alter/Geschlecht/Grösse ein,
die App zeigt daraufhin den berechneten Nährstoffbedarf an. Die Eingabe wird
gespeichert und muss beim nächsten Öffnen der App nicht wiederholt werden.

---

## Aufgaben

### 1. Profil-Datenmodell finalisieren
- Falls noch nicht vorhanden: `UserProfile`-Interface zentral ablegen
  (z.B. `src/data/models/userProfile.ts`), mit mindestens:
  - `age: number`
  - `gender: 'male' | 'female'` (bewusst binär halten wegen DACH-Referenzwerten,
    die nach Geschlecht gestaffelt sind — das kann im Bericht als bewusste
    Vereinfachung erwähnt werden)
  - `heightCm: number`
- `localStorageService.ts` um typisierte Funktionen ergänzen (falls noch nicht
  vorhanden): `getUserProfile(): UserProfile | null`, `saveUserProfile(profile:
  UserProfile): void`

### 2. Feature-Modul für die UI-Logik
```
src/features/profile/
  profileForm.ts        # Formular: rendern + Validierung + Speichern
  profileView.ts         # Anzeige des gespeicherten Bedarfs
```
(Vanilla-TS-Ansatz: Klassen oder Funktionen, die ein DOM-Element befüllen,
kein Framework)

### 3. Formular-Komponente (`profileForm.ts`)
- Einfaches HTML-Formular: Alter (Number-Input), Geschlecht (Radio/Select),
  Grösse (Number-Input, cm)
- Client-seitige Validierung: sinnvolle Min/Max-Ranges (z.B. Alter 10–100,
  Grösse 100–230cm), Fehlermeldung bei ungültiger Eingabe
- Bei Submit: Profil via `saveUserProfile()` speichern, danach zur
  Bedarfs-Anzeige wechseln (kein Page-Reload nötig, einfacher DOM-Wechsel reicht)
- Formular soll auch zum **Bearbeiten** eines bereits gespeicherten Profils
  nutzbar sein (z.B. "Profil bearbeiten"-Link von der Anzeige aus)

### 4. Bedarfs-Anzeige (`profileView.ts`)
- Lädt Profil via `getUserProfile()`
- Ruft `getRequirementsForProfile(profile)` auf
- Zeigt die berechneten Werte als einfache Liste/Tabelle an (Nährstoff, Wert,
  Einheit) — noch **kein** Chart, das kommt in einer späteren Instruktion
- Klar erkennbarer Button/Link "Profil bearbeiten"

### 5. App-Einstiegspunkt anpassen (`src/app/`)
- Beim Start prüfen: Ist ein Profil gespeichert?
  - Nein → Formular anzeigen
  - Ja → direkt Bedarfs-Anzeige zeigen
- Einfacher State-Wechsel reicht (kein Router nötig für diesen Umfang —
  Formular/Anzeige sind die einzigen zwei "Screens" bisher)

### 6. Styling
- Mobile-first, da die App primär auf iPad/iPhone genutzt werden soll
- Formular-Felder ausreichend gross für Touch-Bedienung (min. 44px Tap-Ziele,
  Apple-Empfehlung)
- Bestehende CSS-Variablen aus dem Setup weiterverwenden, keine neue
  Design-Basis einführen

### 7. Edge Cases
- Ungültige/beschädigte Daten in localStorage (z.B. durch manuelles Editieren)
  sollen nicht zu einem Absturz führen — beim Lesen defensiv parsen, im
  Zweifel Formular erneut anzeigen statt Fehler zu werfen

---

## Was NICHT Teil dieses Auftrags ist
- Keine Charts/Visualisierung (kommt später)
- Keine Rezepte oder Nährstoffaufnahme-Berechnung
- Kein Routing-Framework
- Keine Mehrsprachigkeit

## Nach Abschluss
Bitte kurz zeigen/beschreiben:
- Wie der Übergang zwischen "kein Profil vorhanden" und "Profil vorhanden"
  konkret gelöst wurde
- Ob und wie die Validierung getestet wurde
