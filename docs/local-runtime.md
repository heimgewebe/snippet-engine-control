# Local Runtime & Operations

This guide covers the canonical, reproducible workflow for running, updating, and diagnosing `snippet-engine-control` locally.
Our focus here is a stable operational model separated from development-specific concerns or personal path hardcoding.

## Prerequisites

Ensure you have the following installed on your system:
- `node` (version 20 or later)
- `npm`
- `espanso` (installed and initialized)

---

## 1. Initial Setup

Clone the repository and run the update script to cleanly build your local instance.

```bash
git clone <repository_url>
cd snippet-engine-control

# Make operation scripts executable
chmod +x scripts/*.sh

# Run canonical installation and build
./scripts/update-local.sh
```

---

## 2. Running Local Diagnostics

We provide a robust debugging script specifically for the local Engine environments (currently espanso). It checks paths, config layouts, binary availability, and file presence.

```bash
# General environment diagnostic script
./scripts/espanso-debug.sh

# SEC Core Engine Validation via CLI
npm run doctor:espanso
```

`ESPANSO_DIR` can be explicitly set. If unset, `npm run doctor:espanso` uses internal engine discovery.

### Typical Error Cases:
- **`Espanso Config Directory not found`**: Ensure espanso is installed and its config directory exists at the expected path:
  - Linux: `~/.config/espanso`
  - macOS: `~/Library/Application Support/espanso`
  - Windows: `%APPDATA%/espanso`
  Or explicitly set `ESPANSO_DIR`.
- **Doctor validation failures (`error` or `unknown` health statuses)**: Often due to permissions, missing base directories or bad configurations. The doctor logs to stderr.

---

## 3. Starting the UI

To start the local web UI (which serves the workbench UI and backend API), you must have successfully built the project (`npm run build`).

```bash
npm run ui
```

This starts a local daemon on port 4000. Open `http://localhost:4000` in your browser.

In the UI, you have three distinct actions for your snippets:
* **Save**: Saves the snippet internally within the SEC workspace.
* **Dry-run Export**: Shows the export plan against the configured or discovered Espanso target directory.
* **Apply to Espanso**: Writes the export plan to that Espanso target directory and attempts to reload Espanso.

---

## 4. Keeping it Updated

When you pull new changes from `main`, always execute the local update script to synchronize dependencies and artifacts.

```bash
# Pull remote changes (we keep git logic out of our build scripts)
git pull --ff-only

# Rebuild safely
./scripts/update-local.sh
```

**Note on artifacts:** If you experience "stale artifacts" or phantom TypeScript/test errors from the `dist/` folders, you may need a clean build. In future iterations, we may provide a specific `npm run clean` command. Currently, deleting `dist/` and `node_modules` folders manually guarantees a fresh start.

---

## 5. Wrapping locally (`~/bin/sec-local`)

Personal wrappers or aliases are great for your local operating comfort, but should **never** be checked into this repository.

A valid local wrapper (e.g., in `~/bin/sec-local`) could look like:

```bash
#!/bin/bash
# Local wrapper for sec UI
cd ~/path/to/your/snippet-engine-control
npm run ui
```

This ensures we keep specific personal configurations out of our codebase while giving you IDE-like comfort on your local machine.