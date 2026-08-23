# Instruktion 10: Daten-Backup (Export/Import) auf der Profilseite

## Kontext
Aufbauend auf:
- `src/data/localStorageService.ts` — Profil
- `src/data/indexedDbService.ts` — `menus` (Instruktion 6),
  `logEntries` (Instruktion 9)
- `src/features/profile/` — bestehende Profilseite

Ziel: Sämtliche lokal gespeicherten Daten (Profil, eigene Menüs, Log-
Einträge) sollen sich als eine Datei exportieren und wieder importieren
lassen — als Schutz vor Datenverlust (z.B. Browser-Cache leeren, neues
Gerät). Die bestehende Profilseite wird dafür um einen Abschnitt erweitert,
**keine neue eigenständige Seite**.

Zusätzlich: `navigator.storage.persist()` beim App-Start anfordern, um das
Risiko eines automatischen Löschens durch den Browser bei Speicherdruck zu
reduzieren (kein Ersatz fürs Backup, aber sinnvolle Ergänzung).

---

## Aufgaben

### 1. Backup-Datenstruktur
`src/features/backup/models/backup.ts`:
```ts
interface BackupData {
  schemaVersion: number;   // aktuell 1 — für künftige Formatänderungen
  exportedAt: string;      // ISO-Timestamp
  profile: UserProfile | null;
  menus: Menu[];
  logEntries: LogEntry[];
}
```
`schemaVersion` ist wichtig, falls sich das Datenmodell später nochmal
ändert (z.B. neues Feld) — dann kann beim Import unterschieden werden,
ob die Datei zum aktuellen Format passt oder eine Migration/Fehlermeldung
nötig ist. Für jetzt reicht eine einfache Prüfung "Version bekannt? Ja/Nein".

### 2. Backup Service
`src/features/backup/backupService.ts`:
- `exportBackup(): Promise<BackupData>`
  - liest Profil (`getUserProfile()`), alle Menüs (`getAllMenus()`), alle
    Log-Einträge (bitte prüfen, ob es bereits eine Funktion gibt, die
    **alle** Einträge über alle Tage liefert — falls `indexedDbService`
    bisher nur `getLogEntriesForDate` anbietet, eine zusätzliche
    `getAllLogEntries()` ergänzen)
- `downloadBackup(): Promise<void>`
  - ruft `exportBackup()` auf, erzeugt Blob + Download
  - Dateiname: `nutribalance-backup-<YYYY-MM-DD>.json`
- `importBackup(data: BackupData): Promise<void>`
  - validiert `schemaVersion` (siehe Punkt 4)
  - **ersetzt** vollständig: Profil überschreiben, bestehende Menüs und
    Log-Einträge löschen und durch die importierten ersetzen (kein Merge —
    bewusst einfach gehalten, siehe "Was nicht Teil ist")

### 3. UI: Erweiterung der Profilseite
> **Update nach Rückmeldung:** Ursprünglich war der Abschnitt auf der
> Bedarfs-Anzeige ("Mein Bedarf") vorgesehen — dort war er aber schwer zu
> finden, da die App bei bestehendem Profil direkt auf dem Tages-Log
> startet. Stattdessen: eigener Nav-Eintrag **"Profil"** in der
> Hauptnavigation (`appNav.ts`), der direkt zum Profil-Formular
> (`profileForm.ts`) führt. Der Backup-Abschnitt sitzt dort (nicht mehr auf
> "Mein Bedarf") — sowohl beim Bearbeiten eines bestehenden Profils als auch
> im Willkommens-Formular ohne Profil (z.B. nach Browser-Cache leeren, siehe
> unten), damit Import/Export immer über denselben Weg ("Profil")
> erreichbar ist.

Bestehende Profilseite (`src/features/profile/`) um einen neuen Abschnitt
"Daten-Backup" ergänzen, z.B. unterhalb der Profil-Bearbeitung:
- Button **"Daten sichern"** → ruft `downloadBackup()` auf, danach kurze
  Bestätigung sichtbar ("Backup heruntergeladen")
- Button **"Daten wiederherstellen"** → öffnet Datei-Auswahl
  (`<input type="file" accept=".json">`)
  - Nach Dateiauswahl: JSON parsen, validieren (Punkt 4)
  - **Vor dem eigentlichen Import ein Bestätigungsdialog**, da destruktiv:
    „Dadurch werden alle aktuell gespeicherten Daten (Profil, Menüs,
    Log-Einträge) durch die Daten aus der Backup-Datei ersetzt. Fortfahren?"
  - Nach erfolgreichem Import: kurze Erfolgsmeldung, danach z.B. zurück zum
    Log-Screen (mit den neu importierten Daten)
- Kurzer erklärender Text im Abschnitt, warum das sinnvoll ist (z.B. "Deine
  Daten werden nur lokal auf diesem Gerät gespeichert. Erstelle regelmässig
  ein Backup, falls du den Browser-Cache leerst oder das Gerät wechselst.")

### 4. Validierung beim Import
- Datei muss valides JSON sein — sonst klare Fehlermeldung, kein Absturz
- `schemaVersion` muss vorhanden und (aktuell) `1` sein — bei unbekannter
  Version klare Fehlermeldung ("Diese Backup-Datei ist mit einer anderen
  App-Version erstellt worden und kann nicht importiert werden"), **kein**
  Versuch, unbekannte Formate zu "erraten"
- Grundstruktur prüfen (z.B. `menus` und `logEntries` sind Arrays,
  `profile` ist entweder `null` oder hat die erwarteten Felder) — bei
  Fehler abbrechen, **bevor** irgendetwas an den bestehenden Daten
  verändert wird (kein teilweiser Import, der den Zustand inkonsistent
  zurücklässt)

### 5. Storage-Persistenz anfordern
`src/app/` (App-Start) ergänzen:
- Beim Start `navigator.storage.persist()` aufrufen (Feature-Detection:
  prüfen, ob `navigator.storage` überhaupt existiert, bevor aufgerufen wird
  — nicht jeder Browser unterstützt das)
- Ergebnis nicht kritisch behandeln (weder Fehler werfen noch den Start
  blockieren, falls nicht unterstützt oder abgelehnt) — einfach best-effort
- Optional, falls es sich sauber einbauen lässt: kleiner, dezenter Hinweis
  im Backup-Abschnitt der Profilseite, ob persistenter Speicher aktiv ist
  (`navigator.storage.persisted()`), rein informativ, kein Muss

### 6. Tests
- Unit-Test: Export → Import (Round-Trip) ergibt identischen Datenzustand
- Unit-Test: Import mit falscher/fehlender `schemaVersion` wird sauber
  abgelehnt, ohne bestehende Daten zu verändern
- Unit-Test: Import mit kaputtem JSON wird abgefangen, klare Fehlermeldung

---

## Was NICHT Teil dieses Auftrags ist
- Kein Merge-Import (z.B. "nur fehlende Einträge ergänzen") — Import ersetzt
  immer vollständig, das hält die Logik einfach und das Verhalten
  vorhersehbar
- Keine automatischen/periodischen Backups
- Kein Cloud-/Server-Sync
- Keine Migration zwischen unterschiedlichen `schemaVersion`-Ständen (aktuell
  gibt es nur Version 1, das ist für später, falls das Datenmodell sich
  nochmal ändert)

## Nach Abschluss
Bitte zeigen:
- Kurzer Ablauf: Backup erstellen (Datei-Inhalt kurz zeigen) → lokale Daten
  im Browser löschen (z.B. IndexedDB/localStorage manuell leeren) →
  Backup-Datei importieren → Profil/Menüs/Log sind wieder da
- Bestätigen, dass `navigator.storage.persist()` mit Feature-Detection
  eingebaut wurde und den App-Start nicht blockiert, falls nicht unterstützt
