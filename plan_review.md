# Befund

- **Phase 0-7:** Bereits vollständig umgesetzt und dokumentiert.
- **Phase 8 (Workbench-Komfort):**
  - **Erledigt:** Explorer, Tabs, Search/Filter, Statusbar, Conflict navigation, Command bar. Belegt in `app.js` und `index.html`.
  - **Offen:** Settings.
- Die Diagnose zeigt, dass der nächste logische Schritt in Phase 8 (Workbench-Komfort) die Implementierung der `Settings`-Funktion ist. Dies stärkt den IDE-Charakter der Applikation, wie in der Blaupause und Architektur vorgesehen.

# Optimierung der Roadmap
Die Reihenfolge der Blaupause bleibt optimal. Da `Settings` in der Roadmap für Phase 8 aussteht, werden wir eine rudimentäre Settings-Ansicht einbauen. Im Kontext der Applikation bedeutet `Settings` oft, Engine-Targets oder einfache Ansichtsoptionen zu konfigurieren. Da es keine externen Targets außer Espanso bisher gibt, werde ich Settings primär als UI-Hülle und Statusanzeige in der Web-Workbench anlegen. Falls Settings in der `core/app`-Architektur persistiert werden sollen (z.B. in LocalStorage oder über eine neue WorkspaceService-Funktion), implementieren wir dies im Einklang mit den Prinzipien: UI hält keine Domänenwahrheit.

# Konkreter Umsetzungsschritt: Settings-Panel (UI) & Settings-State
1. Erweiterung des Workspace-Modells in App (falls nicht schon vorhanden) oder Nutzung des LocalStorage für UI-Settings. Da `Settings` ein UI-Feature in Phase 8 ist, kann es ein einfaches Modal im UI (mit Tab/Command) sein, das z.B. Theme oder Editor-Modi ("Structured Mode", "Raw Engine Mode") ansteuert oder anzeigt.
2. Da "Settings" auf "offen" steht, baue ich ein "Settings"-Modal in `index.html` ein, das über das Command Palette (`Cmd+K`) und/oder einen Settings-Button in der Sidebar/Statusbar erreichbar ist.
3. Danach setze ich in `blaupause.md` das Häkchen bei `[x] Settings` und update die PR-Kette unter `[x] PR 8+ feat(ui): workbench comfort and navigation (completed)`.
