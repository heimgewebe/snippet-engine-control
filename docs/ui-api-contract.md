# UI ↔ Backend API Contract (Local Daemon)

This document defines the strictly local HTTP API interface between the UI package and the Core/CLI daemon. The daemon runs on localhost and provides the UI with access to the snippet store, diagnostics, and export planning.

## 1. Get All Snippets
- **Endpoint:** `GET /api/snippets`
- **Response:**
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
- **Request Body:** The full `Snippet` object.
- **Response:** `200 OK` (with updated snippet object).

## 3. Validate Snippet
- **Endpoint:** `POST /api/diagnostics/validate`
- **Request Body:** The `Snippet` object currently being edited.
- **Description:** Runs conflict, boundary, and encoding analyzers against the current snippet and the rest of the store.
- **Response:**
  ```json
  {
    "conflicts": [],
    "boundaries": [],
    "encodings": []
  }
  ```

## 4. Preview Expansion
- **Endpoint:** `POST /api/preview`
- **Request Body:** The `Snippet` object.
- **Response:**
  ```json
  {
    "preview": "Hello World"
  }
  ```

## 5. Dry-Run Export
- **Endpoint:** `POST /api/export/dry-run`
- **Request Body:** `{}` (triggers a dry-run export plan build for all snippets in the store).
- **Response:** The `ExportPlan` object (as defined in `packages/core/src/export/plan.ts`).
