# Instruktion 2: Nährwertdatenbank einbinden + Feature-Modul "Nährstoffbedarf"

## Kontext
Aufbauend auf dem bestehenden Vite + TypeScript (vanilla) Setup. Zwei Teilaufgaben:
1. Schweizer Nährwertdatenbank (Lebensmittel-Zusammensetzung) als lokale JSON-Datei
   einbinden.
2. Erstes Feature-Modul für **Nährstoffbedarf** (Referenzwerte, NICHT die tatsächliche
   Aufnahme) aufsetzen — reine Daten- und Logik-Schicht, noch keine UI.

Wichtig: Das sind **zwei unterschiedliche Datensätze**, die nicht verwechselt werden
dürfen:
- **Nährwertdatenbank** (naehrwertdaten.ch) = was ist in welchem Lebensmittel drin
  (pro 100g)
- **Nährstoffbedarf** (DACH-Referenzwerte) = wie viel eine Person je nach Alter/
  Geschlecht braucht

---

## Teil A: Schweizer Nährwertdatenbank einbinden

1. **Datenquelle**
   - Excel-Datei ist bereits heruntergeladen: quellen/Schweizer_Nahrwertdatenbank.xlsx

2. **Konvertierungs-Skript**
   - Node-Skript unter `scripts/convert-food-db.ts` (oder `.js`), das die Excel-Datei
     einliest (z.B. mit der Library `xlsx`) und in sauberes JSON konvertiert
   - Nur die deutsche Sprachspalte extrahieren (andere Sprachen vorerst ignorieren,
     Struktur aber so anlegen, dass später einfach erweiterbar)
   - Output: `public/data/food-database.json`
   - Skript als npm-Befehl verfügbar machen: `npm run convert:food-db`
   - **Wichtig für die schriftliche Arbeit**: Skript soll nachvollziehbar/
     dokumentiert sein (Kommentare, welche Spalten wie gemappt werden), da das
     Teil der Methodik-Beschreibung werden könnte

3. **TypeScript-Datenmodell**
   - `src/data/models/food.ts` mit einem `FoodItem`-Interface, das die relevanten
     Felder abbildet, u.a.:
     - `id`, `name`
     - `category`
     - `energyKcal`
     - Makronährstoffe: `protein`, `fat`, `carbohydrates`, `sugar`, `fiber`,
       `saturatedFat`
     - Wasser-/Alkoholgehalt
     - Mikronährstoffe als strukturiertes Objekt (z.B. `vitamins: { ... }`,
       `minerals: { ... }`), jeweils mit Einheit
   - Werte, die in der Quelldatei fehlen ("n.a." o.ä.), sauber als `null`
     abbilden, nicht als 0 — das ist ein wichtiger fachlicher Unterschied
     (fehlender Wert ≠ kein Gehalt)

4. **Zugriffs-Service**
   - `src/data/foodDatabaseService.ts`
   - Lädt `food-database.json` per `fetch()` zur Laufzeit (nicht ins JS-Bundle
     einbacken — Datei ist zu gross für sinnvolles Bundling)
   - Einfache Funktionen: `getAllFoods()`, `getFoodById(id)`,
     `searchFoodsByName(query: string)`
   - Ergebnis nach erstem Laden im Speicher cachen (einfaches Modul-Level-Caching
     reicht, keine Überengineering nötig)

---

## Teil B: Feature-Modul "Nährstoffbedarf"

1. **Ordnerstruktur**
   ```
   src/features/nutrient-requirements/
     data/
       referenceValues.ts       # DACH-Referenzwerte als strukturierte Daten
     models/
       requirement.ts           # Typen
     requirementService.ts      # Logik: Bedarf für ein UserProfile berechnen
   ```

2. **Datenmodell** (`models/requirement.ts`)
   - `NutrientRequirement`: Nährstoff-ID, Einheit, Wert (oder Wertebereich:
     min/empfohlen/max, da manche Nährstoffe nur einen Schätzwert statt einer
     festen Empfehlung haben — DACH unterscheidet zwischen "empfohlene Zufuhr",
     "Schätzwert" und "Richtwert")
   - `AgeGroup` + `Gender` als Basis für die Differenzierung (DACH-Werte sind
     nach Altersgruppen und Geschlecht gestaffelt, teils auch nach
     Schwangerschaft/Stillzeit — das kann vorerst ausgeklammert werden)

3. **Referenzdaten** (`data/referenceValues.ts`)
   - Struktur für die D-A-CH-Referenzwerte (Deutschland/Österreich/Schweiz),
     auf denen auch die Schweizer Empfehlungen basieren
   - **Wichtig — bitte nicht raten**: Claude Code soll hier nur Werte eintragen,
     die aus einer verifizierbaren Quelle stammen (z.B. DACH-Referenzwerte-Tabelle
     der SGE — Schweizerische Gesellschaft für Ernährung, https://www.sge-ssn.ch,
     oder direkt https://www.dge.de/wissenschaft/referenzwerte/). Für den Start
     reichen die **Makronährstoffe (Energie, Protein, Fett, Kohlenhydrate,
     Ballaststoffe) für 2–3 Altersgruppen (z.B. 15–19, 19–25, 25–51 Jahre,51-75 Jahre) je
     Geschlecht** — Rest kann als klar markierter Platzhalter (`TODO: Quelle
     prüfen`) angelegt werden, den du danach manuell mit korrekten Werten
     befüllst. Für meine Matura-Arbeit muss jeder Zahlenwert am Ende einer
     nachvollziehbaren Quelle zugeordnet werden können.

4. **Service-Logik** (`requirementService.ts`)
   - Funktion `getRequirementsForProfile(profile: UserProfile): NutrientRequirement[]`
   - Ordnet Alter/Geschlecht der passenden Altersgruppe zu und gibt die
     entsprechenden Referenzwerte zurück
   - Noch keine UI, aber eine einfache Konsolen-Testausgabe oder ein Unit-Test
     ist sinnvoll, um zu prüfen, dass die Zuordnung stimmt
---

## Was NICHT Teil dieses Auftrags ist
- Keine UI/Charts
- Kein Feature-Modul für die tatsächliche Nährstoff**aufnahme** (kommt in einer
  späteren Instruktion, vermutlich basierend auf Rezepten + Portionen)
- Keine Verknüpfung zwischen Bedarf und Aufnahme (Vergleich/Visualisierung)

## Nach Abschluss
Bitte auflisten:
- Welche Nährstoffe/Altersgruppen in `referenceValues.ts` bereits mit echten
  Werten befüllt sind vs. welche noch als TODO markiert sind
- Eine kurze Übersicht der finalen JSON-Struktur von `food-database.json`
  (Beispiel-Eintrag)
