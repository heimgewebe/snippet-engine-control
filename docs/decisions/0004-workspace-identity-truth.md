# ADR 0004: Workspace Identity & File Paths Truth

## Status
Accepted

## Context
During Phase 0, we established the "Product-Truth" by diagnosing the current state of identity usage, file serving, and the build outputs across the monorepo to safely plan the rollout of `stableId` and `revisionId`.

### `id` Usage and Fingerprints
- `snippet.id` is currently used across adapters (e.g., `adapter-espanso`) and the UI to uniquely identify snippets.
- `fingerprint(snippet)` currently computes an ID for snippets when reading from the engine (`packages/adapter-espanso/src/espanso/read.ts`) or when hashing them.
- In `packages/core/src/model/store.ts`, the in-memory store relies exclusively on `id`.
- The UI DOM currently binds snippet manipulation (selection, loading, DOM element `data-id`s) heavily to `id`.

### Asset Paths
- **Daemon Serving Path:** `packages/cli/src/daemon.ts` maps `req.url` relative to `path.resolve(__dirname, '../../../ui')` to serve `index.html` and other assets.
- **UI Asset Path:** The UI runs at the root path (`/`) fetching `/app.js` and CSS directly from the daemon's static file handler.

### CLI and Build Outputs
- Running `npm run build` consistently compiles everything using TypeScript project references (`tsc -b`).
- The CLI build outputs are placed in `packages/cli/dist/src/index.js`, which acts as the main executable for the `sec` command.
- The standard user flow via CLI runs:
  1. `sec validate` (exits 0 if valid)
  2. `sec export` (returns the JSON export plan)
  3. `sec apply` (executes dry-run by default)
  4. `sec apply --yes` (actually writes to the engine file)

## Decision
We confirm that the existing infrastructure handles packaging and the `validate -> dry-run -> apply` pipeline smoothly.
Because the UI and core models currently share the single `id` field derived from `fingerprint()`, we confirm that introducing `stableId` and `revisionId` will require refactoring the `Store`, `Snippet` type, Adapter reads, and UI state mapping to differentiate between long-term reference (`stableId`) and content tracking (`revisionId`).

## Consequences
- **Positive:** We have an explicit baseline to implement Phase 1.
- **Negative/Constraint:** We must carefully migrate the UI to use `stableId` for element keys, selection state, and history, reserving `revisionId` solely for changes and diffing.
