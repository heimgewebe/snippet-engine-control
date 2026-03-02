# Repository-Beschreibung (für README + GitHub)

## `snippet-engine-control`

**Engine-neutrale Kontroll- und Diagnoseschicht für Text-Expansion-Systeme.**

`snippet-engine-control` ist kein UI für ein einzelnes Tool, sondern eine abstrahierte Kontroll- und Validierungsebene für Snippet-Engines wie Espanso – mit perspektivischer Erweiterbarkeit.

Ziel ist nicht nur das Bearbeiten von Snippets, sondern deren:

* strukturelle Normalisierung
* Konfliktanalyse
* Boundary-Validierung
* Encoding-Überprüfung
* Engine-Kompatibilitätsprüfung
* diffbare Export-Planung

---

## Kernidee

Text-Expansion-Engines sind Implementierungen.
Snippets sind semantische Objekte.

Dieses Repository trennt beides durch eine kanonische **Intermediate Representation (IR)** und adapterbasierte Engine-Integrationen.

```
Core IR  →  Analyzer  →  ExportPlan  →  Engine Adapter
```

---

## Leitprinzipien

1. **Contract-first**
   Snippets existieren als strukturierte, engine-neutrale Datenmodelle.

2. **Diagnose vor Anwendung**
   Änderungen werden als ExportPlan simuliert, bevor sie geschrieben werden.

3. **Engine-Adapter statt Engine-Bindung**
   Espanso ist der erste Adapter – nicht die Identität des Projekts.

4. **Diffbarkeit statt Magie**
   Jede Transformation ist nachvollziehbar und reproduzierbar.

5. **CLI-first, UI-second**
   Kontrolle vor Komfort.

---

## Aktueller Fokus

* Core-Datenmodell
* Konflikt- und Boundary-Analyse
* Espanso-Adapter
* CLI (validate / export / apply / doctor)

---

## Perspektivische Erweiterung

* Weitere Engines (z. B. AutoKey, AHK)
* UI mit Diagnose-Dashboard
* Trigger-Konfliktvisualisierung
* Live-Snippet-Simulation
* Input-Ereignis-Analyse

---

## Abgrenzung

`snippet-engine-control` ist:

* kein reiner YAML-Editor
* kein Snippet-Marktplatz
* kein Cloud-Dienst
* keine Engine selbst

Es ist eine Kontroll- und Qualitätssicherungsschicht über bestehenden Engines.

---

## Motivation

In realen Systemen treten Probleme auf durch:

* Trigger-Kollisionen
* inkonsistente Wortgrenzen
* fehlerhafte Encodings
* Engine-spezifische Einschränkungen
* instabile Runtime-Zustände

Dieses Projekt macht diese Zustände sichtbar und kontrollierbar.

---

## Kurzbeschreibung (GitHub One-Liner)

> Engine-neutral control plane for text-expansion systems with contract-first modeling, diagnostics, and diffable export planning.
