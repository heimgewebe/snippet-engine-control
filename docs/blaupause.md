# Blaupause für snippet-engine-control

## Teil A — Strategischer Überblick

### 1. Nordstern

`snippet-engine-control` wird als deterministische Control-Plane für Text-Expansion-Snippets weiterentwickelt.
Der Kern ist nicht „Snippet-Editing“, sondern:

`Workspace-Zustand → Validation → Preview → ExportPlan → Apply → Verify → Runtime-Feedback`

Die Repo-Dokumentation legt genau diese Trennung bereits an: `core` definiert die semantische Wahrheit, `app` orchestriert Flüsse, `adapter-espanso` enthält die Wirklichkeit des Zielsystems, `cli` und `ui` präsentieren nur.

### 2. Zielbild

#### 2.1 Kanonische Schichten

Die bestehende Struktur ist die richtige Basis und soll nicht aufgelöst, sondern geschärft werden:
- `contracts/` = formale Datengrenzen
- `packages/core/` = IR, Analyzer, Export-Semantik
- `packages/app/` = Workspace-, Plan-, Apply-, History-Orchestrierung
- `packages/adapter-espanso/` = Datei-, Runtime-, Snapshot-, Restart-Realität
- `packages/cli/` = Kommandos, Daemon, textuelle Kontrolle
- `packages/ui/` = lokale Workbench-Oberfläche

#### 2.2 Produktwahrheit

Die dokumentierte Blaupause des Repos ist bereits stark:
`saveDraft → buildPlan → applyPlan` ist als expliziter Produktfluss gesetzt; dazu kommen Verify, Snapshot/Rollback, Preview und History.

Die neue Blaupause setzt daher nicht auf neue Grundideen, sondern auf fünf Härtungen:
1. Plan als erstklassiges Artefakt
2. Deterministische Apply-/Verify-Kette
3. Eine einzige Runtime-Wahrheit
4. UI nur als Projektion, nie als Eigenlogik
5. Explizite Drift-Prüfung zwischen Dokumentation, Contracts und Implementierung

### 3. Architekturelle Leitprinzipien

#### 3.1 Plan-first statt Write-first

Der ExportPlan ist nicht Hilfsobjekt, sondern das zentrale epistemische Artefakt. ADR 0003 legt genau das an: Änderungen sollen zuerst diffbar und nachvollziehbar sein, erst dann geschrieben werden. Den Plan als expliziten Contract stabilisieren.

#### 3.2 Eine Runtime-Wahrheit

Runtime-Wahrheit entsteht nur aus:
- health
- verify
- runDoctor
- realem Apply-Ergebnis
- realem Restart-/Log-Status

Nicht aus UI-Gefühl.

#### 3.3 Workspace vor UI

Die Repo-Blaupause beschreibt Workspace, SnippetSet, SnippetDocument, stableId, revisionId und History als zentrale Produktachse. Diese Achse muss dominieren. UI-Komfort wie Search, Tabs, Command Bar und Dark Theme darf nur darauf aufsetzen.

#### 3.4 Adapter enthält Wirklichkeit, nicht Produktlogik

ADR 0002 und `docs/adapters.md` sind hier klar: der Adapter liest, schreibt, verifiziert, liefert Health/Status/Logs – aber entscheidet nicht über Produktflüsse.

### 4. Konkrete Ausbauachsen

#### 4.1 Achse A — Contracts vervollständigen

Ein klarer Contract fehlt für:
- ExportPlan
- ApplyResult
- RuntimeHealth
- VerificationResult
- HistoryEntry / SnapshotMetadata

**Nutzen:** CI kann echte Drift prüfen, UI/CLI/Adapter sprechen härter dieselbe Sprache, künftige zweite Engine würde nicht alles weichspülen.

#### 4.2 Achse B — Determinismus absichern

Zielinvarianten:
- derselbe Workspace + dieselbe Zielumgebung → derselbe Plan
- Apply ohne Änderungen → no-op
- Verify prüft nicht nur Struktur, sondern semantische Zielübereinstimmung
- Restart-Fehler verändern nicht rückwirkend das Apply-Ergebnis

Empfohlene Tests:
- idempotenter zweiter Apply
- deterministische Plan-Erzeugung bei identischem Input
- Verify nach Write und nach Restart getrennt testbar
- Fehlerklassen klar: ENOENT ≠ EISDIR ≠ YAML kaputt ≠ Runtime down

#### 4.3 Achse C — UI semantisch konsistent machen

UI-Blaupause:
1. Default-Semantik korrekt setzen: `wordBoundary` bei neuen Snippets standardmäßig aktiv.
2. Dark Theme wirklich durchziehen: Farbvariablen systematisch überziehen.
3. Resultattypen sichtbarer machen: `saved`, `planned`, `applied`, `verified`, `restart failed`.
4. No-op explizit zeigen: „keine Änderungen“ ist ein Ergebnis, kein Schweigen.
5. UI und Runtime entkoppelt visualisieren: „Datei geschrieben“ ≠ „Engine läuft“ ≠ „Trigger expandiert“.

#### 4.4 Achse D — Local Runtime professioneller machen

Sinnvolle Endform:
- `sec-ui.service` dauerhaft aktiv: ja, sinnvoll
- `sec-update` als kanonischer Updatepfad
- `doctor:espanso` nach Updates automatisch empfohlen
- espanso-Servicefehler klar in UI spiegeln
- kein repo-lokaler `.espanso`-Schattenbetrieb mehr im Normalpfad

#### 4.5 Achse E — Docs und Implementierung synchronisieren

Jede relevante Produktänderung braucht:
- Doc-Update
- Test
- falls Artefakt semantisch wichtig: Contract oder Typ-Härtung

Besonders wichtig: `docs/ui-api-contract.md`, `docs/local-runtime.md`, `docs/blaupause.md`, ADRs.

### 5. Konkrete Blaupause als PR-Kette

- [ ] **PR A — contracts(export-runtime): formalize plan/apply/runtime artifacts**
  - ExportPlan-Schema
  - ApplyResult-Schema
  - RuntimeHealth-/Verify-Schema
  - Typen angleichen
- [ ] **PR B — test(determinism): harden plan/apply invariants**
  - idempotenter Apply
  - deterministische Plan-Erzeugung
  - klare Fehlerklassen
  - verify/write/restart getrennt testbar
- [ ] **PR C — feat(ui): default word-boundary and coherent dark theme**
  - `wordBoundary` default
  - Dark Theme mit Variablen statt Fleckenfärbung
  - no-op/degraded/applied status sichtbar
- [ ] **PR D — docs(runtime): add recovery runbooks and truth table**
  - Runtime-Fehlerbilder
  - systemd/espanso-Recovery
  - Wahrheitstabelle (saved, planned, written, restarted, verified)
- [ ] **PR E — feat(status): explicit runtime/result state in workbench**
  - Statusbar / bottom panel
  - typed apply result rendering
  - runtime doctor feedback in UI


---

## Teil B — Aktueller kanonischer Stand

Dieses Repo ist bereits in einer Phase der funktionalen Reife. Der nächste Schritt ist Konsolidierung und Härtung, nicht Greenfield-Aufbau. Die folgenden Produktwahrheiten sind bereits kanonisch etabliert:

### Kanonische Schichten
- **`contracts`**: Formalisiert Datengrenzen.
- **`packages/core`**: Domänenlogik (Analyzer, Normalize, Fingerprint, ExportPlan-Basis).
- **`packages/app`**: Die eigentliche Produktmitte (Workspace, Validation, Preview, Plan, Apply, Snapshot, History).
- **`packages/adapter-espanso`**: Wirklichkeitsschicht für Espanso (discover, read, write, preview, doctor, restart, runtime, snapshot, exec).
- **`packages/cli`**: Präsentations- und Daemon-Schicht (apply.ts, daemon.ts, doctor.ts, plan.ts, validate.ts).
- **`packages/ui`**: Workbench-Oberfläche im Browser.

### Zentraler Produktfluss
Der kanonische Ablauf ist streng sequenziell:
`saveDraft → buildPlan → applyPlan`
Änderungen werden erst geplant, als diffbares Artefakt erzeugt, und dann sicher auf die Runtime angewendet.

### Abgeschlossene Phasen
Die Phasen 0 bis 8 (wie im historischen Referenz-Blueprint definiert) sind weitgehend abgeschlossen. Das bedeutet konkret:
- **Preview**, **Verification**, **History / Undo**, und sichere **Apply**-Pfade sind bereits operativ eingeführt.
- Ein **pre-apply Snapshot** samt einfachem Rollback existiert.
- Der **Workbench-Komfort** (Explorer, Tabs, Search/Filter, Command Bar, Conflict Navigation, Settings) in der UI ist funktional vorhanden.
- **Workspace-Identität** (`stableId` + `revisionId`) wurde gefestigt.


---

## Teil C — Produktreife / Nächster Fokus

### Wo wir heute stehen
Das Repository bietet einen funktionalen lokalen Workspace. Die Engine-Ziele können validiert, geparst und exportiert werden. Der Nutzer hat den notwendigen Komfort (Tabs, Workspace-Historie), um produktiv arbeiten zu können.

### Was als Nächstes fehlt
Die Herausforderung liegt nun darin, den bestehenden Komfort auf **härtere, deterministische Fundamente** zu stellen:
- Die Trennung von `saveDraft`, `buildPlan` und `applyPlan` muss in formalisierten Contracts verankert werden.
- Die Rückmeldung der lokalen Runtime (Fehlerzustände, Logs, Verify-Resultate) muss aus dem Adapter strikt typisiert an die App- und UI-Schicht weitergegeben werden, ohne Semantikdrift durch „schöne“ Modalboxen.
- Ein idempotenter `Apply`-Schritt und deterministische Plans garantieren, dass das Repo wie ein strikter zustandsbewusster Compiler fungiert.

Genau darauf zielt die im *Strategischen Überblick* definierte **PR-Kette A–E** ab.


---

## Historische Referenz

Die ausführliche historische Phasen-, Architektur- und PR-Definition (Phasen 0 bis 8) ist archiviert unter:
[**`docs/archive/blaupause-legacy.md`**](archive/blaupause-legacy.md)

Diese Zwei-Ebenen-Struktur wurde bewusst gewählt:
- Das **Hauptdokument (`docs/blaupause.md`)** dient der aktuellen kanonischen Orientierung und strategischen Zielführung für die Härtung.
- Das **Archiv (`docs/archive/blaupause-legacy.md`)** bewahrt die ausführliche, detaillierte Entwicklungsform (Entscheidungen, Typ-Historie, verworfene Alternativen) der frühen Produktphasen.
