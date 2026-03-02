# ADR 0001: Core IR

## Context
Wir brauchen eine Zwischenrepräsentation (Intermediate Representation) für Snippets, anstatt engine-spezifische Formate direkt zu bearbeiten.

## Decision
Wir definieren eine kanonische **Intermediate Representation (IR)** für Snippets. Diese IR enthält alle wesentlichen semantischen Informationen, ohne an eine spezifische Engine (wie Espanso YAML) gebunden zu sein.

## Consequences
* Erlaubt CLI und UI unabhängig von spezifischen Engines zu arbeiten.
* Ermöglicht das Hinzufügen weiterer Engine-Adapter in der Zukunft.
* Führt eine Abstraktionsschicht ein, die übersetzt werden muss.
