# ADR 0003: Export Plan

## Context
Wie wir Änderungen an Engine-Dateien sicher durchführen.

## Decision
Wir generieren einen `ExportPlan`, bevor Änderungen geschrieben werden. Dies erzeugt einen **diffbaren** Plan ("welche Files werden wie verändert?"), um stille Glättung oder undefinierbares Verhalten zu verhindern.

## Consequences
* Jede Transformation ist nachvollziehbar und reproduzierbar.
* Verhindert unabsichtliche Zerstörung von YAML-Dateien.
* Verbessert die Diagnostizierbarkeit.
