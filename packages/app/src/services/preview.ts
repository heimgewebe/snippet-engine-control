import { Snippet, PreviewResult, PreviewContext, simulateExpansion } from '@snippet-engine-control/core';
import { EnginePreviewPort } from '../ports/engine';
import { Workspace } from '../model/workspace';

export class PreviewService {
  constructor(private enginePort?: EnginePreviewPort) {}

  /**
   * Generates a preview for a single snippet document.
   * If an engine port is provided, it uses engine-aware preview.
   * Otherwise, it falls back to the static/template-aware simulator.
   */
  public previewDocument(snippet: Snippet, ctx: PreviewContext = {}): PreviewResult {
    if (this.enginePort) {
      try {
        return this.enginePort.preview(snippet, ctx);
      } catch (error: any) {
        return {
          text: snippet.body || '',
          isTemplate: false,
          warnings: [`Engine preview failed: ${error.message}`]
        };
      }
    }

    // Fallback to core analyzer
    return simulateExpansion(snippet);
  }

  /**
   * Rebuilds previews for all currently active/relevant contexts in a workspace.
   * Currently, this might just mean the active document or dirty documents.
   */
  public previewWorkspaceContext(workspace: Workspace): void {
    if (!workspace.activeDocumentId) return;

    for (const set of workspace.snippetSets) {
      const doc = set.snippets.find(s => s.stableId === workspace.activeDocumentId);
      if (doc) {
        doc.derived.preview = this.previewDocument(doc.ir, {
          engineTarget: workspace.engineTarget
        });

        // Update the workspace preview state as well
        workspace.previewState.activePreviewId = doc.stableId;
        workspace.previewState.results[doc.stableId] = doc.derived.preview;
        break;
      }
    }
  }
}
