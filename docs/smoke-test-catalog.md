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
- **Command:** `node packages/cli/dist/src/index.js apply --yes`
- **Expected:** Process successfully writes `sec.generated.yml` to the configured Espanso directory and prints "Successfully applied snippets."

### ST05: Daemon Launch & Token Injection
- **Command:** `node packages/cli/dist/src/index.js ui`
- **Expected:** Daemon binds to 127.0.0.1 (unless --allow-lan is supplied). Visiting the URL returns HTML that successfully embeds `window.__SEC_TOKEN__`.

### ST06: Adapter Resilience
- **Condition:** Pass an invalid YAML file to `readSnippets`.
- **Expected:** Process throws an explicit error indicating file path and parsing failure details, ensuring it fails closed.
