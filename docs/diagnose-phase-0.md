# Technische Diagnose-Notiz: Phase 0

## 1. `snippet.id` usage
- **Packages Core:** Used in `Snippet` interface, `Store`, `fingerprint`, and various diagnostic analyzers (`boundaries`, `conflicts`, `encoding`).
- **Packages App:** Used for `ValidationService` to find snippets to attach diagnostics.
- **Packages UI:** Heavily used in `app.js` and `index.html` (e.g., `s.id === id`, `<li data-id="...">`, API calls `/snippets/${id}`).
- **Packages Adapter-Espanso:** Used in tests and during `readSnippets` to compute an `id` string via `fingerprint()`.
- **Packages CLI:** Used in `lint`, `validate`, `export`, and `plan` when referencing snippets with unsupported features or diagnostics.

## 2. Fingerprint producers
- `fingerprint(snippet: Snippet)` resides in `packages/core/src/ir/fingerprint.ts`.
- The primary consumer generating the fingerprint is `readSnippets` in `packages/adapter-espanso/src/espanso/read.ts` where it generates a deterministic 12-character substring of the SHA-256 hash.

## 3. Daemon Serving Path
- Handled in `packages/cli/src/daemon.ts` via `http.createServer`.
- URL resolution relies on `path.resolve(__dirname, '../../../ui')` statically serving `req.url || 'index.html'`.
- Token (`X-SEC-Token`) injected directly into `index.html`.

## 4. UI Asset Path
- `packages/ui/app.js` and CSS are loaded by the browser from `/app.js` resolving natively via the static file handler checking extensions and setting `Content-Type`.

## 5. CLI Build Output Path
- Code built via `tsc -b`.
- Executable located at `packages/cli/dist/src/index.js` referencing core imports.

## 6. Full flow commands
```bash
node packages/cli/dist/src/index.js validate
# Output:
# Validating snippets...
# OK

node packages/cli/dist/src/index.js export
# Output:
# {
#   "changes": [],
#   "unsupportedFeatures": []
# }

node packages/cli/dist/src/index.js apply
# Output:
# Dry run: skipping write
# {
#   "changes": [],
#   "unsupportedFeatures": []
# }

node packages/cli/dist/src/index.js apply --yes
# Output:
# Successfully applied snippets.
```
