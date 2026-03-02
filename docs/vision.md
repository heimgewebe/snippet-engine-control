# Vision

`snippet-engine-control` is an engine-neutral control plane for text-expansion systems with contract-first modeling, diagnostics, and diffable export planning.

## Dialektik

### These
Das Repo braucht „eine Beschreibung“.

### Antithese
Eine Beschreibung ist oft Marketingtext.
Was wir brauchen, ist eine **architektonische Selbstdefinition**, die Scope, Grenzen und Zukunft offenlegt – sonst driftet das Projekt.

### Synthese
Wir schreiben eine Beschreibung, die:
* Engine-neutral ist
* Contract-first betont
* Diagnosefähigkeit als Kern hervorhebt
* Expansion nicht verspricht, sondern ermöglicht

## Kernidee
Text-Expansion-Engines sind Implementierungen.
Snippets sind semantische Objekte.

Dieses Repository trennt beides durch eine kanonische **Intermediate Representation (IR)** und adapterbasierte Engine-Integrationen.

```
Core IR  →  Analyzer  →  ExportPlan  →  Engine Adapter
```

## Leitprinzipien
1. **Contract-first**: Snippets existieren als strukturierte, engine-neutrale Datenmodelle.
2. **Diagnose vor Anwendung**: Änderungen werden als ExportPlan simuliert, bevor sie geschrieben werden.
3. **Engine-Adapter statt Engine-Bindung**: Espanso ist der erste Adapter – nicht die Identität des Projekts.
4. **Diffbarkeit statt Magie**: Jede Transformation ist nachvollziehbar und reproduzierbar.
5. **CLI-first, UI-second**: Kontrolle vor Komfort.
