# Blaupause

## Nordstern

> `snippet-engine-control` wird als **domänenspezifische Snippet-IDE-Control-Plane** gebaut:
> mit `core` als semantischem Motor, `app` als Orchestrierungsschicht, `adapter-espanso` als Engine-Brücke, `cli` als textuelle Präsentation, `ui` als Workbench-Oberfläche und einer strikt getrennten Achse aus **Draft speichern**, **Plan erzeugen**, **Apply ausführen**.

---

## Architekturgrundsätze

### 1. Eine einzige Domänenwahrheit

`core` + `contracts` definieren:

* Snippet
* Diagnostics
* Engine Capabilities
* ExportPlan
* PreviewResult-Basistypen
* keine alternativen Domänenmodelle in `ui`, `cli`, `adapter-*`

### 2. App-Schicht als Pflicht, nicht Dekoration

`packages/app` ist die einzige Schicht, die:

* Nutzerflüsse orchestriert
* Workspace-Zustand verwaltet
* Save/Plan/Apply verbindet
* Preview/Validation zusammenführt

### 3. Adapter enthalten Wirklichkeit, nicht Produktlogik

`adapter-espanso` darf:

* lesen
* schreiben
* verifizieren
* health/status/log liefern

Aber nicht:

* UI-State führen
* Workspace-Modelle besitzen
* Produktflüsse entscheiden

### 4. Präsentation bleibt dumm genug

`cli` und `ui` dürfen:

* Eingaben annehmen
* Zustände anzeigen
* Aktionen auslösen

Sie dürfen nicht:

* selbst Domänenwahrheit erzeugen
* Parallelmodelle pflegen
* Save/Apply semantisch neu interpretieren

### 5. Save ≠ Apply ist unverhandelbar

* `saveDraft`: interner Zustand (Persistenzdomäne/Ziel für Drafts aktuell offene Designentscheidung)
* `buildPlan`: Änderungsvorschau
* `applyPlan`: externe Wirkung

Jede Vermischung davon gilt als Drift.

### 6. Produktwahrheit vor Workbench-Kosmetik

Eine schöne Oberfläche ohne belastbaren Apply-/Verify-/Rollback-Pfad ist nur dekorierte Unruhe.

---

## Zielarchitektur

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

## Repo-Zielstruktur

Aktuelle Struktur:
* `docs/decisions/`: Architektur- und Designentscheidungen

Ziel-/Zukunftsstruktur:
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

## Kanonisches Datenmodell

### Workspace

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

### SnippetSet

```ts
type SnippetSet = {
  id: string
  name: string
  source: SourceRef
  snippets: SnippetDocument[]
}
```

### SnippetDocument

```ts
type SnippetDocument = {
  stableId: string
  revisionId: string
  ir: Snippet
  dirty: boolean
  derived: {
    diagnostics?: Diagnostics
    preview?: PreviewResult
    exportImpact?: ExportImpact
  }
}
```

> Diagnostics originate from the core layer and use the structured `Diagnostics` type defined in `@snippet-engine-control/core`. Earlier references to `Diagnostic[]` in this document represent a simplified conceptual form rather than a separate type definition.

---

## Identitätsprinzip

### stableId

Dauerhafte Objektidentität im Workspace.

### revisionId

Inhalts-/Revisionsidentität, z. B. aus Fingerprint abgeleitet.

### Regel

* UI, Tabs, Selection, History, Referenzen laufen über `stableId`
* Revisionsvergleich, Diffs, Caching, Export-Nachvollzug laufen über `revisionId`

### Warum?

Weil Fingerprints gute Revisionsmarker und schlechte Personenkennzeichen sind.

---

## Produktfluss

### 1. Import / Open Workspace

* Adapter liest Quelle
* App baut Workspace
* Dokumente erhalten `stableId`
* aktuelle Revision wird erfasst

### 2. Edit

* Änderungen treffen `SnippetDocument.ir`
* `dirty = true`
* `revisionId` ändert sich
* `stableId` bleibt

### 3. Validate

* `ValidationService`
* Diagnose auf Dokument- und Workspace-Ebene
* Ergebnisse werden als derived state abgelegt

### 4. Preview

* `PreviewService`
* statisch → template-aware → engine-aware ausbaubar

### 5. SaveDraft

* speichert internen Workspace-/Draft-Zustand (interne Persistenzgrenze)
* keine externen Engine-Dateien

### 6. BuildPlan

* erzeugt ExportPlan + Diff/Impact
* markiert Verifikationsstand

### 7. ApplyPlan

* schreibt über Adapter
* löst Verification aus
* erzeugt Snapshot/Restore-Punkt

### 8. Verify

* prüft reale Artefakte
* Health/Status/Fehler
* aktualisiert RuntimeState

---

## Gedächtnis-Klassen: Draft, History und Snapshot

* **saveDraft**: interne Persistenzgrenze. Sichert den lokalen Workspace-Zustand. Ob dies In-Memory, in einer lokalen Workspace-Datei oder einer Sidecar-Datei passiert, ist noch eine **offene Designentscheidung**.
* **history**: editorinterne State-Evolution. Betrifft lokales Undo/Redo sowie den Verlauf des Workspace-/Dokument-Zustands über Zeit.
* **snapshot**: Pre-Apply Sicherheitsgrenze für externe Effekte. Dient als Backup *vor* Änderungen an Engine-Dateien und erlaubt den Restore nach einem Rollout-Fehler.

---

## Services im App-Layer

### Pflicht-Services

#### WorkspaceService
Repo target: `packages/app/src/services/workspace.ts`
* openWorkspace
* selectDocument
* updateDocument
* dirty tracking
* workspace state transitions

#### ValidationService
Repo target: `packages/app/src/services/validation.ts`
* validateDocument
* validateWorkspace
* derived diagnostics

#### PreviewService
Repo target: `packages/app/src/services/preview.ts`
* previewDocument
* previewWorkspaceContext
* später Simulationsebenen

#### PlanService
Repo target: `packages/app/src/services/plan.ts`
* buildPlan
* calculateImpact
* outdated-plan detection

#### ApplyService
Repo target: `packages/app/src/services/apply.ts`
* applyPlan
* trigger verification
* emit apply result

#### SnapshotService
Repo target: `packages/app/src/services/snapshot.ts`
* pre-apply snapshot
* restore latest snapshot

#### HistoryService
Repo target: `packages/app/src/services/history.ts`
* undo/redo
* local revisions
* last-applied state

---

## Port-Modell

### Read (Current implemented port boundary)

```ts
interface EngineReadPort {
  readSnippets(inputPath?: string): Snippet[]
  readSnippetsFromEngine(dir?: string): Snippet[]
}
```

### Write (Current implemented port boundary)

```ts
interface EngineWritePort {
  writeSnippets(plan: ExportPlan): void
}
```

### Verify / Health (Proposed target port)

```ts
interface EngineRuntimePort {
  verify(plan: ExportPlan): VerificationResult
  health(): RuntimeHealth
  logs?(opts?: LogOptions): RuntimeLogChunk[]
}
```

### Preview optional engine-aware (Proposed target port)

```ts
interface EnginePreviewPort {
  preview(snippet: Snippet, ctx: PreviewContext): PreviewResult
}
```

---

## UI-Zielbild

### Workbench Shell

```text
Workbench
 ├─ Sidebar / Explorer
 ├─ Main Editor Area
 ├─ Right Diagnostics + Preview Pane
 ├─ Bottom Output / Diff / Runtime / Logs
 └─ Command Layer / Statusbar
```

### Editor Modes

1. **Form Mode**
2. **Structured Mode**
3. **Raw Engine Mode**

### UI-Regeln

* UI hält keine eigene Domänenwahrheit
* UI arbeitet gegen Workspace-State
* UI zeigt stale/outdated/dirty/verified explizit an

---

## Testing-Blaupause

### 1. Domain-Tests

* core analyzers
* normalize
* export plan
* revision/fingerprint utilities

### 2. App-Tests

* stableId/revisionId behavior
* workspace transitions
* save/build/apply flow
* preview state
* snapshot/restore

### 3. Adapter-Tests

* import/export roundtrip
* file permission handling
* verify
* restart/health/log where applicable

### 4. Presentation-Tests

* CLI argument behavior
* daemon auth/origin/token
* UI smoke

### 5. E2E-Produkt-Tests

Mindestens ein realer End-to-End-Pfad:

```text
open → edit → validate → preview → dry-run → apply → verify
```

---

## Entwicklungsphasen: die optimale Reihenfolge

### Phase 0 — Diagnose & Product-Truth
Status: completed

#### Ziel

Keine stillen Annahmen.

#### Aufgaben
- [x] grep/rg all uses of snippet.id
- [x] list all fingerprint producers
- [x] trace daemon serving path for /
- [x] trace UI asset path for app.js
- [x] verify CLI build output path
- [x] run one full flow: validate -> dry-run -> apply
- [x] document exact command lines and expected outputs

#### Output

* 1 ADR
* 1 technische Diagnose-Notiz
* Smoke-Test-Katalog

#### Stop-Kriterium

Klarheit darüber:

* wo `id` heute wirkt
* wie Packaging tatsächlich läuft
* wie Apply real endet

---

### Phase 1 — Stabile Identität
Status: completed

#### Ziel

`stableId + revisionId`

#### Aufgaben
- [x] Datenmodell erweitern (Typen in `app/model` eingeführt)
- [x] Store umbauen
- [x] Adapter-Import-Mapping
- [x] Tests

#### Stop-Kriterium

Dokumentidentität bleibt im Editor stabil.

---

### Phase 2 — Workspace-Modell
Status: completed

#### Ziel

Kanonischer `Workspace`

#### Aufgaben
- [x] Workspace-Typen
- [x] aktives Dokument
- [x] Dirty-/Derived-State
- [x] Session-Grundlage

#### Stop-Kriterium

Die App kann mehrere Dokumente logisch verwalten.

#### Abnahmehinweis
Kanonische `Workspace`-Typen eingeführt. `WorkspaceService` verwaltet nun den kanonischen Zustand als Session-Grundlage. CLI-Daemon nutzt den Service statt direkter Store-Zugriffe. Tests für State Transitions (open/select/add/update/delete) sind grün.

---

### Phase 3 — Produktfluss
Status: completed

#### Ziel

Expliziter Pfad:

```text
saveDraft → buildPlan → applyPlan
```

#### Aufgaben
- [x] DraftService
- [x] PlanService
- [x] Apply-Orchestrierung
- [x] UI/CLI daran anschließen

#### Stop-Kriterium

Der Produktfluss ist ohne UI testbar.

---

### Phase 4 — Packaging + E2E
Status: completed

#### Ziel

Produktwahrheit belegen.

#### Aufgaben
- [x] CLI-Build-Truth
- [x] Daemon/UI-Serving-Truth
- [x] E2E-Smoke
- [x] ein echter Produktpfad

#### Stop-Kriterium

Das Produkt läuft reproduzierbar, nicht nur seine Pakete.

---

### Phase 5 — Verification + Minimal Safety
Status: completed

#### Ziel

Apply vertrauenswürdig machen.

#### Aufgaben
- [x] post-apply verification (structural YAML + content-hash verification implemented)
- [x] runtime health (basic configuration diagnostics implemented)
- [x] pre-apply snapshot
- [x] rollback via latest pre-apply snapshot (MVP)

#### Abnahmehinweis
Minimal safety path eingeführt: pre-apply snapshot, rollback on write/verify failure, explicit CLI rollback.
Hinweis zur jetzigen MVP-Tiefe (completed):
- Rollback ist rein dateibasiert (neuester Snapshot) ohne feste Bindung an Apply-Metadaten.
- Post-apply verification ist strukturell und prüft YAML sowie Content-Hashes präzise gegen den ExportPlan.
- Runtime health prüft grundlegende Konfigurationsdiagnostik (Existenz, Verzeichnisstruktur, Lesbarkeit).

#### Stop-Kriterium

Ein fehlgeschlagenes Apply ist erkennbar und begrenzbar.

---

### Phase 6 — Preview ausbauen
Status: planned

#### Ziel

Preview entscheidungsrelevant machen.

#### Ebenen
- [x] 1. static
- [x] 2. template-aware
- [ ] 3. engine-aware
- [ ] 4. expansion trace

#### Stop-Kriterium

Preview hilft real bei Konflikt- und Rollout-Entscheidungen.

---

### Phase 7 — History / Undo / Restore
Status: completed

#### Ziel

Interne Vertrauensschicht

#### Aufgaben
- [x] workspace history
- [x] document revision history
- [x] undo/redo
- [x] restore from snapshot

#### Stop-Kriterium

Benutzerfehler sind reparierbar.

---

### Phase 8 — Workbench-Komfort
Status: actively being implemented

#### Ziel

IDE-Reichtum, aber auf stabilem Fundament.

#### Aufgaben
- [x] Explorer
- [x] Tabs
- [x] Search/Filter
- [x] Conflict navigation
- [x] Statusbar
- [x] Command bar
- [ ] Settings

#### Stop-Kriterium

Mehr Komfort ohne neue Semantikdrift.

---

## Umsetzungsreihenfolge als PR-Kette

- [x] **PR 0** diagnose(product): map id-flow, apply-flow and packaging truth
- [x] **PR 1** refactor(app): introduce stableId/revisionId document model
- [x] **PR 2** feat(app): add canonical workspace model and session state
- [x] **PR 3** refactor(app): explicit saveDraft/buildPlan/applyPlan flow
- [x] **PR 4** build(e2e): prove product flow end-to-end
- [x] **PR 5** feat(runtime): verification and minimal apply safety (completed)
- [x] **PR 6** feat(preview): layered preview pipeline (static & template-aware)
- [x] **PR 7** feat(history): workspace snapshots and undo/redo (completed)
- [ ] **PR 8+** feat(ui): workbench comfort and navigation (partial: Tabs, Search/Filter, Statusbar, diagnostics-based conflict navigation, initial Command bar)

---

## Konkrete Erfolgskriterien

### Produktreife V0.1

* Workspace kann geöffnet werden
* Snippets haben stabile Identität
* Bearbeiten verliert keine Selektion
* Validate/Preview/Dry-Run funktionieren
* Apply schreibt reproduzierbar
* Verification zeigt Ergebnis
* letzter Apply ist begrenzbar rücknehmbar

### Produktreife V0.2

* History/Snapshots
* bessere Preview
* E2E stabil
* Search/Conflict Navigation

### Produktreife V1.0

* Packaging stabil
* Runtime belastbar
* Onboarding/Doku
* klare Fehlermeldungen
* robuste Produkt-Tests

---

## Was ausdrücklich **nicht** zuerst gebaut werden soll

* Plugin-System
* Marketplace
* zweite Engine nur der Abstraktion zuliebe
* große UI-Neuschreibung
* Workbench-Schmuck vor Produktwahrheit
* „intelligente“ Simulation ohne stabile Identität

---

## Risiko- und Nutzenabschätzung

### Nutzen

* geringere spätere Umbaukosten
* ehrliche Schichtentrennung
* frühere Produktverifikation
* weniger Drift
* bessere Testbarkeit
* klarere Nutzerflüsse

### Risiken

* Phase 0 wirkt weniger „sichtbar“
* Identitätsumbau kann mehrere Pfade berühren
* Workspace-Modell kann `app` kurzfristig aufblasen
* Packaging/E2E früher zu ziehen kostet Disziplin

### Gegenmittel

* jede Phase mit Stop-Kriterium
* jede Phase als kleiner PR
* keine Scope-Erweiterung unterwegs
* Diagnose-Gate vor riskanten Umbauten

---

## Typische Fehlannahmen, aktiv korrigiert

### Fehlannahme 1

**„Die UI ist der nächste Hebel.“**
Nein. Die nächste Wahrheit ist Identität.

### Fehlannahme 2

**„Fingerprint-ID reicht.“**
Nein. Für Revision gut, für Workspace-Objektidentität schlecht.

### Fehlannahme 3

**„Preview zuerst macht das Produkt wertvoller.“**
Nur scheinbar. Ohne verlässlichen Produktfluss bleibt das kosmetisch.

### Fehlannahme 4

**„Packaging kann am Ende geklärt werden.“**
Nein. Produktwahrheit braucht frühe Laufrealität.

### Fehlannahme 5

**„Mehr Architektur ist automatisch besser.“**
Nein. Architektur ist nur dann gut, wenn sie spätere Änderungen billiger und sicherer macht.

---

## Belegt / plausibel / spekulativ

### Belegt

* `packages/app` existiert bereits als richtige Keimzelle.
* Read-/Write-Port-Trennung ist umgesetzt.
* UI/Daemon/CLI sind anschlussfähig.
* Contract-first und ExportPlan-Achse sind real.

### Plausibel

* `stableId + revisionId` ist der größte nächste Hebel.
* Workspace-Modell ist die nächste notwendige Abstraktion.
* Packaging/E2E früher zu ziehen reduziert Produktillusion.

### Spekulativ

* Wie stark Runtime/Packaging real noch hakt; dazu fehlen vollständige Build-/Release-Belege.

---

## Essenz

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
