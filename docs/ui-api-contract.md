# UI ↔ Backend API Contract (Local Daemon)

This document defines the strictly local HTTP API interface between the UI package and the Core/CLI daemon. The daemon runs on localhost and provides the UI with access to the snippet store, diagnostics, and export planning.

## Security and Access Control

Because the daemon serves a sensitive local API, it must adhere to strict security constraints to prevent Cross-Site Request Forgery (CSRF), Cross-Site Scripting leaks (XSS/XS-Leaks), and unauthorized Local Area Network (LAN) access:

1. **Loopback Only:** The daemon MUST bind exclusively to loopback interfaces (e.g., `127.0.0.1` and/or `::1`) by default. It MUST NOT bind to `0.0.0.0` unless explicitly requested via an opt-in CLI flag.
2. **No Wildcard CORS:** The daemon MUST NOT use wildcard CORS headers (`Access-Control-Allow-Origin: *`). Cross-origin requests are denied.
3. **Origin Enforcement:** The daemon MUST enforce `Origin` header restrictions. If an `Origin` header is present, it must strictly match the daemon's host (e.g., `http://127.0.0.1:<port>` or `http://localhost:<port>`). Otherwise, the request is rejected with `403 Forbidden`.
4. **Authentication Token:** The daemon generates a random, unguessable cryptographic token on startup. This token is injected into the served HTML.
   - ALL `/api/*` endpoints (including `GET /api/snippets`) MUST require this token via the `X-SEC-Token` HTTP header to prevent XS-Leaks and unintended local access. State-changing endpoints MUST require it.
   - Requests lacking a valid token MUST be rejected with `401 Unauthorized` or `403 Forbidden`.

---

## 1. Get All Snippets
- **Endpoint:** `GET /api/snippets`
- **Headers:** `X-SEC-Token: <token>`
- **Response:** (Matches `#/$defs/SnippetListResponse` in `ui-api.schema.json`)
  ```json
  [
    {
      "id": "abc123def456",
      "triggers": [":hello"],
      "body": "Hello World",
      "origin": { "source": "espanso", "path": "..." }
    }
  ]
  ```

## 2. Update Snippet
- **Endpoint:** `PUT /api/snippets/:id`
- **Headers:** `X-SEC-Token: <token>`
- **Request Body:** The full `Snippet` object (Matches `https://snippet-engine-control.local/snippet.schema.json`).
- **Response:** `200 OK` (with updated snippet object matching `https://snippet-engine-control.local/snippet.schema.json`) or `401 Unauthorized`.

## 3. Validate Snippet
- **Endpoint:** `POST /api/diagnostics/validate`
- **Headers:** `X-SEC-Token: <token>`
- **Request Body:** The `Snippet` object currently being edited (Matches `https://snippet-engine-control.local/snippet.schema.json`).
- **Description:** Runs conflict, boundary, and encoding analyzers against the current snippet and the rest of the store.
- **Response:** (Matches `#/$defs/ValidationResponse` in `ui-api.schema.json`)
  ```json
  {
    "conflicts": [],
    "boundaries": [],
    "encodings": []
  }
  ```

## 4. Preview Expansion
- **Endpoint:** `POST /api/preview`
- **Headers:** `X-SEC-Token: <token>`
- **Request Body:** The `Snippet` object (Matches `https://snippet-engine-control.local/snippet.schema.json`).
- **Response:** (Matches `#/$defs/PreviewResponse` in `ui-api.schema.json`)
  ```json
  {
    "preview": "Hello World"
  }
  ```

## 5. Dry-Run Export
- **Endpoint:** `POST /api/export/dry-run`
- **Headers:** `X-SEC-Token: <token>`
- **Request Body:** `{}` (triggers a dry-run export plan build for all snippets in the store).
- **Response:** The `ExportPlan` object (as defined in `packages/core/src/export/plan.ts`).
