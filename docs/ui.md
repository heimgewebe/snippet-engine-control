# UI (Phase 2, aber schon vorbereitet)

`packages/ui/`

* Editor (Snippet CRUD)
* Diagnostics View (Konflikte, Boundaries, Encoding)
* Apply/Dry-run Button (zeigt ExportPlan)
* Log panel (adapter liefert log tail)

UI spricht **nur** mit lokalem Backend (CLI/daemon). Kein Cloud-Kram.
