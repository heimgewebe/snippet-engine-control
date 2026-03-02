# Architecture

Wir bauen **engine-neutral im Kern**, aber **nur einen Adapter** (Espanso) zuerst. Alles andere bleibt als leere, dokumentierte Schnittstelle.

## Top-Level Layout
```text
snippet-engine-control/
  contracts/
    snippet.schema.json   # kanonisches Snippet-Objekt
    engine.schema.json    # Engine-Capabilities & constraints
    diagnostics.schema.json

  packages/
    core/                 # engine-neutral: Modell + Analysen + Export-IR
    adapter-espanso/      # espanso import/export + runtime ops
    cli/                  # devtool: validate, export, sync, doctor
    ui/                   # web-ui (später)
```

## Leitprinzipien

* **Core ≠ Adapter ≠ UI**
* **Model/Contracts zuerst**, dann Implementierungen
* **Diagnostik als First-Class** (Konflikte, Wortgrenzen, Encoding, Engine-Capabilities)
* **Keine Hidden-Magic**: Jede Transformation ist explizit, diffbar
