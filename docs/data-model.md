# Data Model (Core-IR)

Wir definieren eine **Intermediate Representation (IR)**, damit UI/CLI unabhängig von Engines arbeiten:

## `Snippet` (engine-neutral)
* `id` (stabil)
* `triggers[]` (z. B. `"pri"`, `";pri"`)
* `body` (multiline text)
* `constraints` (word-boundary, app include/exclude, locale hints)
* `tags[]`
* `origin` (Quelle: espanso file, user input)

## `EngineCapabilities`
* supports word-boundary?
* supports multiline?
* supports vars/shell?
* supports global vs app-specific?
* supports hotkeys?

## `Diagnostics`
* trigger collisions
* ambiguous boundaries
* encoding issues
* unsupported features for target engine
