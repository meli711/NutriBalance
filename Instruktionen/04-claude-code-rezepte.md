# Instruktion 4: Aufnahme-Feature (Rezepte + Portionen)

## Kontext
Aufbauend auf:
- `src/data/foodDatabaseService.ts` (Instruktion 2) — Lebensmittel-Nährwerte
  pro 100g
- `src/features/nutrient-requirements/` (Instruktion 2+3) — Bedarf

Jetzt: Rezepte anlegen, die aus Zutaten (Referenz auf Lebensmittel-DB + Menge
in Gramm) bestehen, und daraus die **Nährstoffaufnahme** pro Portion berechnen.

## Design-Entscheidungen (bereits geklärt, bitte so umsetzen)
- Zutatenmengen ausschliesslich in **Gramm** — keine Stück/ml/EL-Umrechnung
- Rezepte referenzieren Zutaten über die `id` aus `food-database.json`,
  **keine** Nährwerte im Rezept selbst duplizieren — Nährwerte werden zur
  Laufzeit über den bestehenden `foodDatabaseService` nachgeschlagen und
  auf die Menge skaliert
- Start mit **5–10 Rezepten**, statisch als JSON im Projekt
- **Wichtig:** Ob Nutzer:innen später eigene Rezepte erstellen können, ist noch
  offen. Deshalb: Zugriff auf Rezepte über eine Service-Schicht kapseln
  (`recipeService.ts`), die aktuell nur die statische JSON-Datei liest.
  So kann später eine zweite Quelle (z.B. IndexedDB für eigene Rezepte)
  ergänzt werden, ohne dass Aufrufer-Code geändert werden muss. Aktuell aber
  **nicht** vorbauen mit ungenutztem IndexedDB-Code — nur die Struktur so
  wählen, dass es sich sauber erweitern lässt.

---

## Aufgaben

### 1. Rezept-Datenmodell
`src/features/recipes/models/recipe.ts`:
```ts
interface RecipeIngredient {
  foodId: string;      // referenziert FoodItem.id aus food-database.json
  amountGrams: number;
}

interface Recipe {
  id: string;
  name: string;
  servings: number;         // Anzahl Portionen, die das Rezept ergibt
  ingredients: RecipeIngredient[];
  instructions?: string[];  // optional, kurze Zubereitungsschritte
}
```

### 2. Rezept-Rohdaten
- `public/data/recipes.json` mit 5–10 Beispielrezepten (thematisch/inhaltlich
  frei wählbar, z.B. ausgewogener Querschnitt: Frühstück, Hauptmahlzeit,
  Snack — damit später bei der Bedarfs-Abdeckung unterschiedliche Nährstoffe
  sichtbar werden)
- Alle referenzierten `foodId`s müssen tatsächlich in `food-database.json`
  existieren — beim Erstellen der Rezepte gegenprüfen, nicht raten

### 3. Recipe Service
`src/features/recipes/recipeService.ts`:
- `getAllRecipes(): Promise<Recipe[]>`
- `getRecipeById(id: string): Promise<Recipe | undefined>`
- Lädt `recipes.json` per `fetch()`, analog zum bestehenden
  `foodDatabaseService`-Muster (Caching nach erstem Laden)

### 4. Nährstoffberechnung pro Rezept/Portion
`src/features/recipes/nutritionCalculator.ts`:
- Funktion `calculateRecipeNutrition(recipe: Recipe): NutrientValues`
  — summiert die Nährwerte aller Zutaten (skaliert von "pro 100g" auf die
  tatsächliche `amountGrams`)
- Funktion `calculatePerServing(recipe: Recipe): NutrientValues`
  — Ergebnis von `calculateRecipeNutrition` geteilt durch `servings`
- `NutrientValues`-Typ so gestalten, dass er zum bestehenden
  `NutrientRequirement`-Typ aus Instruktion 2 kompatibel ist (gleiche
  Nährstoff-IDs/Einheiten verwenden) — das ist wichtig, damit sich Bedarf und
  Aufnahme später ohne Konvertierung vergleichen lassen
- Fehlende Werte in der Lebensmitteldatenbank (`null`, siehe Instruktion 2)
  sauber behandeln: nicht als 0 rechnen, sondern im Ergebnis kennzeichnen,
  dass die Berechnung für diesen Nährstoff unvollständig ist (z.B. Flag
  `incomplete: true` je Nährstoff)

### 5. Minimale UI
`src/features/recipes/recipeListView.ts` + `recipeDetailView.ts`:
- Liste aller Rezepte (Name, Portionen)
- Detailansicht: Zutatenliste + berechnete Nährwerte pro Portion als einfache
  Tabelle (kein Chart, das kommt später)
- Einstiegspunkt in die bestehende App-Navigation einhängen (analog zum
  Profil-Screen aus Instruktion 3 — einfacher State-Wechsel reicht weiterhin,
  noch kein Router nötig)

### 6. Tests
- Unit-Test für `calculatePerServing` mit einem einfachen Beispielrezept
  (Zahlen von Hand nachrechenbar), um Skalierungslogik abzusichern

---

## Was NICHT Teil dieses Auftrags ist
- Kein UI zum Erstellen/Bearbeiten eigener Rezepte
- Keine Mengen-Einheiten ausser Gramm
- Kein Vergleich Bedarf vs. Aufnahme (kommt in der nächsten Instruktion)
- Keine Charts

## Nach Abschluss
Bitte zeigen:
- Ein Beispiel-Rezept aus `recipes.json` inkl. berechnetem Ergebnis
  (`calculatePerServing`), damit sich das Zahlenbeispiel manuell
  gegenprüfen lässt
- Kurz bestätigen: sind `NutrientValues` und `NutrientRequirement` wirklich
  strukturell kompatibel (gleiche Nährstoff-IDs)?
