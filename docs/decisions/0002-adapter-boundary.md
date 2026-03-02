# ADR 0002: Adapter Boundary

## Context
Wie wir Engine-spezifische Code-Logik trennen.

## Decision
Adapter (wie `adapter-espanso`) dürfen **nur** Engine-spezifische Logik enthalten (z. B. Konfiguration lesen, YAML parsen, YAML schreiben, Services restarten). Sie dürfen **keine** UI-Logik oder generischen Kontrollfluss enthalten.

## Consequences
* Saubere Trennung der Verantwortlichkeiten.
* Die Core-Bibliothek bleibt völlig engine-unabhängig.
* Entwickler, die neue Adapter hinzufügen, haben klare Richtlinien.
