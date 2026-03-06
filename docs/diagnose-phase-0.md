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
- URL resolution specifically builds the target path using `const uiDir = path.resolve(__dirname, '../../../ui')` and serves static files using `path.join(uiDir, req.url === '/' ? 'index.html' : req.url || 'index.html')`.
- Token injection works by generating an authentication token and replacing `</head>` in `index.html` with `<script>window.__SEC_TOKEN__ = "${SEC_TOKEN}";</script>\n</head>`. This token is then sent by the UI in the `X-SEC-Token` HTTP header on `/api/*` requests.

## 4. UI Asset Path
- `packages/ui/app.js` and CSS are loaded by the browser directly from the root path (`/app.js`), mapping to the correct native files via the Daemon's `path.join` static serving logic, dynamically assigning `Content-Type` headers based on file extension.

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
