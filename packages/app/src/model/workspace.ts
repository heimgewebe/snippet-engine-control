// Phase-1 workspace model.
// This API surface may evolve while the workspace/store integration
// is implemented in subsequent phases.
import { Snippet, Diagnostics, PreviewResult } from '@snippet-engine-control/core';

// These types are placeholders as they are not yet fully defined in core.
export interface ExportImpact {
  changedFiles: number;
  addedSnippets: number;
  removedSnippets: number;
}

export interface DiagnosticState {
  globalErrors: string[];
  documentDiagnostics: Record<string, Diagnostics>;
}

export interface PreviewState {
  // Placeholder for preview state
  activePreviewId?: string;
  results: Record<string, PreviewResult>;
}

export interface ExportState {
  // Placeholder for export state
  lastExportPath?: string;
  impact?: ExportImpact;
}

export interface RuntimeState {
  // Placeholder for runtime state
  isRunning: boolean;
  lastVerifiedAt?: number;
}

export interface WorkspaceStateSnapshot {
  activeDocumentId?: string;
  // A deep clone of the SnippetSets at the moment the snapshot was taken
  snippetSets: SnippetSet[];
}

export interface WorkspaceHistory {
  undoStack: WorkspaceStateSnapshot[];
  redoStack: WorkspaceStateSnapshot[];
}

export interface SourceRef {
  type: string;
  path: string;
}

export interface SnippetDocument {
  stableId: string;
  revisionId: string;
  ir: Snippet;
  dirty: boolean;
  derived: {
    // Diagnostics come from the core layer and represent the canonical
    // structured diagnostic model. The workspace layer does not redefine
    // a separate Diagnostic[] representation.
    diagnostics?: Diagnostics;
    preview?: PreviewResult;
    exportImpact?: ExportImpact;
  };
}

export interface SnippetSet {
  id: string;
  name: string;
  source: SourceRef;
  snippets: SnippetDocument[];
}

export interface Workspace {
  id: string;
  engineTarget: 'espanso'; // Currently only espanso is supported
  snippetSets: SnippetSet[];
  activeDocumentId?: string;
  diagnostics: DiagnosticState;
  previewState: PreviewState;
  exportState: ExportState;
  runtimeState: RuntimeState;
  history: WorkspaceHistory;
}
