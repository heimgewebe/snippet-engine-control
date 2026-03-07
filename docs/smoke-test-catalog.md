# Smoke-Test-Katalog

## V0.1 Core & Flow Verifications

### ST01: CLI Build & Validation
- **Command:** `npm run build && node packages/cli/dist/src/index.js validate`
- **Expected:** Process exits 0 if inputs match constraints. "OK" is printed.

### ST02: CLI Dry-Run (Export)
- **Command:** `node packages/cli/dist/src/index.js export`
- **Expected:** Process exits 0 and logs valid JSON indicating planned changes to stdout without modifying files.

### ST03: CLI Apply (Dry Run by Default)
- **Command:** `node packages/cli/dist/src/index.js apply`
- **Expected:** Process prints "Dry run: skipping write" and the export plan JSON to stdout.

### ST04: CLI Apply (Actual Write)
- **Condition:** Execution with a valid engine target (`--engine espanso`) and a specific environment-based input path (`SEC_SNIPPETS`).
- **Command:** `SEC_SNIPPETS=<path/to/valid/mock> node packages/cli/dist/src/index.js apply --engine espanso --yes`
- **Expected:** Process writes an updated `sec.generated.yml` to the specific `match` directory within the configured/target Espanso directory without error, bypassing dry-run logic.

### ST05: Daemon Launch & Token Injection
- **Command:** `node packages/cli/dist/src/index.js ui`
- **Expected:** Daemon binds to 127.0.0.1 (unless --allow-lan is supplied). Visiting the URL returns HTML that successfully embeds `window.__SEC_TOKEN__`.

### ST06: Adapter Resilience
- **Condition:** Place an invalid YAML file in the engine's targeted `match` directory and run `readSnippetsFromEngine(dir)`.
- **Expected:** The `yaml.parse` invocation explicitly fails and process throws an error indicating the file path and parsing failure details (`Failed to parse YAML in <path>`), ensuring fail-closed operations.
