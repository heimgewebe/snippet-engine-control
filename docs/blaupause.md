# Blaupause

## Nordstern

> `snippet-engine-control` wird als **domänenspezifische Snippet-IDE-Control-Plane** gebaut:
> mit `core` als semantischem Motor, `app` als Orchestrierungsschicht, `adapter-espanso` als Engine-Brücke, `cli` als textuelle Präsentation, `ui` als Workbench-Oberfläche und einer strikt getrennten Achse aus **Draft speichern**, **Plan erzeugen**, **Apply ausführen**.

---

# Architekturgrundsätze

## 1. Eine einzige Domänenwahrheit

`core` + `contracts` definieren:

* Snippet
* Diagnostics
* Engine Capabilities
* ExportPlan
* PreviewResult-Basistypen
* keine alternativen Domänenmodelle in `ui`, `cli`, `adapter-*`

## 2. App-Schicht als Pflicht, nicht Dekoration

`packages/app` ist die einzige Schicht, die:

* Nutzerflüsse orchestriert
* Workspace-Zustand verwaltet
* Save/Plan/Apply verbindet
* Preview/Validation zusammenführt

## 3. Adapter enthalten Wirklichkeit, nicht Produktlogik

`adapter-espanso` darf:

* lesen
* schreiben
* verifizieren
* health/status/log liefern

Aber nicht:

* UI-State führen
* Workspace-Modelle besitzen
* Produktflüsse entscheiden

## 4. Präsentation bleibt dumm genug

`cli` und `ui` dürfen:

* Eingaben annehmen
* Zustände anzeigen
* Aktionen auslösen

Sie dürfen nicht:

* selbst Domänenwahrheit erzeugen
* Parallelmodelle pflegen
* Save/Apply semantisch neu interpretieren

## 5. Save ≠ Apply ist unverhandelbar

* `saveDraft`: interner Zustand
* `buildPlan`: Änderungsvorschau
* `applyPlan`: externe Wirkung

Jede Vermischung davon gilt als Drift.

## 6. Produktwahrheit vor Workbench-Kosmetik

Eine schöne Oberfläche ohne belastbaren Apply-/Verify-/Rollback-Pfad ist nur dekorierte Unruhe.

---

# Zielarchitektur

```text
contracts/ + core/
        ↓
      app/
        ↓
ports/interfaces
        ↓
adapter-espanso/
        ↓
cli/      ui/
```

---

# Repo-Zielstruktur

```text
packages/
  core/                  # IR, analyzers, export model, revision utilities
  app/                   # workspace, flows, preview orchestration, plan/apply logic
  adapter-espanso/       # espanso import/export/runtime/verify/log/health
  cli/                   # commands, daemon bootstrap, text presentation
  ui/                    # workbench, editor, panels, command layer
contracts/               # schema truth
docs/
  adr/                   # architecture decisions
  product/               # product truth / flows / guarantees
test-e2e/                # end-to-end product verification
```

---

# Kanonisches Datenmodell

## Workspace

```ts
type Workspace = {
  id: string
  engineTarget: "espanso"
  snippetSets: SnippetSet[]
  activeDocumentId?: string
  diagnostics: DiagnosticState
  previewState: PreviewState
  exportState: ExportState
  runtimeState: RuntimeState
  history: WorkspaceHistory
}
```

## SnippetSet

```ts
type SnippetSet = {
  id: string
  name: string
  source: SourceRef
  snippets: SnippetDocument[]
}
```

## SnippetDocument

```ts
type SnippetDocument = {
  stableId: string
  revisionId: string
  ir: Snippet
  dirty: boolean
  derived: {
    diagnostics?: Diagnostic[]
    preview?: PreviewResult
    exportImpact?: ExportImpact
  }
}
```

---

# Identitätsprinzip

## stableId

Dauerhafte Objektidentität im Workspace.

## revisionId

Inhalts-/Revisionsidentität, z. B. aus Fingerprint abgeleitet.

## Regel

* UI, Tabs, Selection, History, Referenzen laufen über `stableId`
* Revisionsvergleich, Diffs, Caching, Export-Nachvollzug laufen über `revisionId`

## Warum?

Weil Fingerprints gute Revisionsmarker und schlechte Personenkennzeichen sind.

---

# Produktfluss

## 1. Import / Open Workspace

* Adapter liest Quelle
* App baut Workspace
* Dokumente erhalten `stableId`
* aktuelle Revision wird erfasst

## 2. Edit

* Änderungen treffen `SnippetDocument.ir`
* `dirty = true`
* `revisionId` ändert sich
* `stableId` bleibt

## 3. Validate

* `ValidationService`
* Diagnose auf Dokument- und Workspace-Ebene
* Ergebnisse werden als derived state abgelegt

## 4. Preview

* `PreviewService`
* statisch → template-aware → engine-aware ausbaubar

## 5. SaveDraft

* speichert internen Workspace-/Draft-Zustand
* keine externen Engine-Dateien

## 6. BuildPlan

* erzeugt ExportPlan + Diff/Impact
* markiert Verifikationsstand

## 7. ApplyPlan

* schreibt über Adapter
* löst Verification aus
* erzeugt Snapshot/Restore-Punkt

## 8. Verify

* prüft reale Artefakte
* Health/Status/Fehler
* aktualisiert RuntimeState

---

# Services im App-Layer

## Pflicht-Services

### WorkspaceService

* openWorkspace
* selectDocument
* updateDocument
* dirty tracking
* workspace state transitions

### ValidationService

* validateDocument
* validateWorkspace
* derived diagnostics

### PreviewService

* previewDocument
* previewWorkspaceContext
* später Simulationsebenen

### PlanService

* buildPlan
* calculateImpact
* outdated-plan detection

### ApplyService

* applyPlan
* trigger verification
* emit apply result

### SnapshotService

* pre-apply snapshot
* restore latest snapshot

### HistoryService

* undo/redo
* local revisions
* last-applied state

---

# Port-Modell

## Read

```ts
interface EngineReadPort {
  readSnippets(inputPath?: string): Snippet[]
  readSnippetsFromEngine(dir?: string): Snippet[]
}
```

## Write

```ts
interface EngineWritePort {
  writeSnippets(plan: ExportPlan): void
}
```

## Verify / Health

```ts
interface EngineRuntimePort {
  verify(plan: ExportPlan): VerificationResult
  health(): RuntimeHealth
  logs?(opts?: LogOptions): RuntimeLogChunk[]
}
```

## Preview optional engine-aware

```ts
interface EnginePreviewPort {
  preview(snippet: Snippet, ctx: PreviewContext): PreviewResult
}
```

---

# UI-Zielbild

## Workbench Shell

```text
Workbench
 ├─ Sidebar / Explorer
 ├─ Main Editor Area
 ├─ Right Diagnostics + Preview Pane
 ├─ Bottom Output / Diff / Runtime / Logs
 └─ Command Layer / Statusbar
```

## Editor Modes

1. **Form Mode**
2. **Structured Mode**
3. **Raw Engine Mode**

## UI-Regeln

* UI hält keine eigene Domänenwahrheit
* UI arbeitet gegen Workspace-State
* UI zeigt stale/outdated/dirty/verified explizit an

---

# Testing-Blaupause

## 1. Domain-Tests

* core analyzers
* normalize
* export plan
* revision/fingerprint utilities

## 2. App-Tests

* stableId/revisionId behavior
* workspace transitions
* save/build/apply flow
* preview state
* snapshot/restore

## 3. Adapter-Tests

* import/export roundtrip
* file permission handling
* verify
* restart/health/log where applicable

## 4. Presentation-Tests

* CLI argument behavior
* daemon auth/origin/token
* UI smoke

## 5. E2E-Produkt-Tests

Mindestens ein realer End-to-End-Pfad:

```text
open → edit → validate → preview → dry-run → apply → verify
```

---

# Entwicklungsphasen: die optimale Reihenfolge

## Phase 0 — Diagnose & Product-Truth

### Ziel

Keine stillen Annahmen.

### Aufgaben

* ID-Impact-Map
* Flow-Map
* Packaging-Truth
* Apply-Truth
* ADR: stabile Identität + Produktfluss

### Output

* 1 ADR
* 1 technische Diagnose-Notiz
* Smoke-Test-Katalog

### Stop-Kriterium

Klarheit darüber:

* wo `id` heute wirkt
* wie Packaging tatsächlich läuft
* wie Apply real endet

---

## Phase 1 — Stabile Identität

### Ziel

`stableId + revisionId`

### Aufgaben

* Datenmodell erweitern
* Store umbauen
* Adapter-Import-Mapping
* Tests

### Stop-Kriterium

Dokumentidentität bleibt im Editor stabil.

---

## Phase 2 — Workspace-Modell

### Ziel

Kanonischer `Workspace`

### Aufgaben

* Workspace-Typen
* aktives Dokument
* Dirty-/Derived-State
* Session-Grundlage

### Stop-Kriterium

Die App kann mehrere Dokumente logisch verwalten.

---

## Phase 3 — Produktfluss

### Ziel

Expliziter Pfad:

```text
saveDraft → buildPlan → applyPlan
```

### Aufgaben

* DraftService
* PlanService
* Apply-Orchestrierung
* UI/CLI daran anschließen

### Stop-Kriterium

Der Produktfluss ist ohne UI testbar.

---

## Phase 4 — Packaging + E2E

### Ziel

Produktwahrheit belegen.

### Aufgaben

* CLI-Build-Truth
* Daemon/UI-Serving-Truth
* E2E-Smoke
* ein echter Produktpfad

### Stop-Kriterium

Das Produkt läuft reproduzierbar, nicht nur seine Pakete.

---

## Phase 5 — Verification + Minimal Safety

### Ziel

Apply vertrauenswürdig machen.

### Aufgaben

* post-apply verification
* runtime health
* pre-apply snapshot
* rollback latest apply

### Stop-Kriterium

Ein fehlgeschlagenes Apply ist erkennbar und begrenzbar.

---

## Phase 6 — Preview ausbauen

### Ziel

Preview entscheidungsrelevant machen.

### Ebenen

1. static
2. template-aware
3. engine-aware
4. expansion trace

### Stop-Kriterium

Preview hilft real bei Konflikt- und Rollout-Entscheidungen.

---

## Phase 7 — History / Undo / Restore

### Ziel

Interne Vertrauensschicht

### Aufgaben

* workspace history
* document revision history
* undo/redo
* restore from snapshot

### Stop-Kriterium

Benutzerfehler sind reparierbar.

---

## Phase 8 — Workbench-Komfort

### Ziel

IDE-Reichtum, aber auf stabilem Fundament.

### Aufgaben

* Explorer
* Tabs
* Search/Filter
* Conflict navigation
* Statusbar
* Command bar
* Settings

### Stop-Kriterium

Mehr Komfort ohne neue Semantikdrift.

---

# Umsetzungsreihenfolge als PR-Kette

## PR 0

**diagnose(product): map id-flow, apply-flow and packaging truth**

## PR 1

**refactor(app): introduce stableId/revisionId document model**

## PR 2

**feat(app): add canonical workspace model and session state**

## PR 3

**refactor(app): explicit saveDraft/buildPlan/applyPlan flow**

## PR 4

**build(e2e): prove product flow end-to-end**

## PR 5

**feat(runtime): verification and minimal apply safety**

## PR 6

**feat(preview): layered preview pipeline**

## PR 7

**feat(history): workspace snapshots and undo/redo**

## PR 8+

**feat(ui): workbench comfort and navigation**

---

# Konkrete Erfolgskriterien

## Produktreife V0.1

* Workspace kann geöffnet werden
* Snippets haben stabile Identität
* Bearbeiten verliert keine Selektion
* Validate/Preview/Dry-Run funktionieren
* Apply schreibt reproduzierbar
* Verification zeigt Ergebnis
* letzter Apply ist begrenzbar rücknehmbar

## Produktreife V0.2

* History/Snapshots
* bessere Preview
* E2E stabil
* Search/Conflict Navigation

## Produktreife V1.0

* Packaging stabil
* Runtime belastbar
* Onboarding/Doku
* klare Fehlermeldungen
* robuste Produkt-Tests

---

# Was ausdrücklich **nicht** zuerst gebaut werden soll

* Plugin-System
* Marketplace
* zweite Engine nur der Abstraktion zuliebe
* große UI-Neuschreibung
* Workbench-Schmuck vor Produktwahrheit
* „intelligente“ Simulation ohne stabile Identität

---

# Risiko- und Nutzenabschätzung

## Nutzen

* geringere spätere Umbaukosten
* ehrliche Schichtentrennung
* frühere Produktverifikation
* weniger Drift
* bessere Testbarkeit
* klarere Nutzerflüsse

## Risiken

* Phase 0 wirkt weniger „sichtbar“
* Identitätsumbau kann mehrere Pfade berühren
* Workspace-Modell kann `app` kurzfristig aufblasen
* Packaging/E2E früher zu ziehen kostet Disziplin

## Gegenmittel

* jede Phase mit Stop-Kriterium
* jede Phase als kleiner PR
* keine Scope-Erweiterung unterwegs
* Diagnose-Gate vor riskanten Umbauten

---

# Typische Fehlannahmen, aktiv korrigiert

## Fehlannahme 1

**„Die UI ist der nächste Hebel.“**
Nein. Die nächste Wahrheit ist Identität.

## Fehlannahme 2

**„Fingerprint-ID reicht.“**
Nein. Für Revision gut, für Workspace-Objektidentität schlecht.

## Fehlannahme 3

**„Preview zuerst macht das Produkt wertvoller.“**
Nur scheinbar. Ohne verlässlichen Produktfluss bleibt das kosmetisch.

## Fehlannahme 4

**„Packaging kann am Ende geklärt werden.“**
Nein. Produktwahrheit braucht frühe Laufrealität.

## Fehlannahme 5

**„Mehr Architektur ist automatisch besser.“**
Nein. Architektur ist nur dann gut, wenn sie spätere Änderungen billiger und sicherer macht.

---

# Belegt / plausibel / spekulativ

## Belegt

* `packages/app` existiert bereits als richtige Keimzelle.
* Read-/Write-Port-Trennung ist umgesetzt.
* UI/Daemon/CLI sind anschlussfähig.
* Contract-first und ExportPlan-Achse sind real.

## Plausibel

* `stableId + revisionId` ist der größte nächste Hebel.
* Workspace-Modell ist die nächste notwendige Abstraktion.
* Packaging/E2E früher zu ziehen reduziert Produktillusion.

## Spekulativ

* Wie stark Runtime/Packaging real noch hakt; dazu fehlen vollständige Build-/Release-Belege.

---

# Essenz

**Die optimale Blaupause lautet nicht:**
„Baue jetzt die ganze IDE.“

**Sondern:**

```text
Diagnose → stabile Identität → Workspace → Produktfluss → Packaging/E2E → Verify/Safety → Preview → History → Komfort
```

**Hebel:**
Die fehlende Mitte ist nicht mehr die App-Schicht an sich, sondern **Workspace-Identität und Produktflusswahrheit**.

**Entscheidung:**
Die optimale Blaupause ist eine **kleine, harte, verifizierbare PR-Kette**, die zuerst Gedächtnis und Produktlogik baut und erst danach die Bühne schmückt.