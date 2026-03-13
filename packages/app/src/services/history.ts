import { Workspace, WorkspaceStateSnapshot, SnippetSet, SnippetDocument } from '../model/workspace';
import { Snippet } from '@snippet-engine-control/core';

export class HistoryService {
  /**
   * Pushes the current workspace state to the undo stack.
   * Clears the redo stack because a new action diverges the history tree.
   */
  public pushState(workspace: Workspace): void {
    const snapshot = this.createSnapshot(workspace);
    workspace.history.undoStack.push(snapshot);
    workspace.history.redoStack = [];
  }

  /**
   * Reverts the workspace to the previous state from the undo stack,
   * pushing the current state to the redo stack.
   */
  public undo(workspace: Workspace): boolean {
    if (workspace.history.undoStack.length === 0) {
      return false; // Nothing to undo
    }

    const currentSnapshot = this.createSnapshot(workspace);
    workspace.history.redoStack.push(currentSnapshot);

    const previousSnapshot = workspace.history.undoStack.pop()!;
    this.restoreSnapshot(workspace, previousSnapshot);

    return true;
  }

  /**
   * Reapplies the next state from the redo stack,
   * pushing the current state back to the undo stack.
   */
  public redo(workspace: Workspace): boolean {
    if (workspace.history.redoStack.length === 0) {
      return false; // Nothing to redo
    }

    const currentSnapshot = this.createSnapshot(workspace);
    workspace.history.undoStack.push(currentSnapshot);

    const nextSnapshot = workspace.history.redoStack.pop()!;
    this.restoreSnapshot(workspace, nextSnapshot);

    return true;
  }

  private createSnapshot(workspace: Workspace): WorkspaceStateSnapshot {
    return {
      activeDocumentId: workspace.activeDocumentId,
      snippetSets: workspace.snippetSets.map(this.cloneSnippetSet.bind(this))
    };
  }

  private cloneSnippetSet(set: SnippetSet): SnippetSet {
    return {
      ...set,
      source: { ...set.source },
      snippets: set.snippets.map(this.cloneSnippetDocument.bind(this))
    };
  }

  private cloneSnippetDocument(doc: SnippetDocument): SnippetDocument {
    return {
      ...doc,
      ir: this.cloneSnippet(doc.ir),
      derived: this.cloneDerivedState(doc.derived)
    };
  }

  private cloneSnippet(snippet: Snippet): Snippet {
    return {
      ...snippet,
      triggers: [...snippet.triggers],
      ...(snippet.constraints ? {
        constraints: {
          ...snippet.constraints,
          ...(snippet.constraints.appInclude ? { appInclude: [...snippet.constraints.appInclude] } : {}),
          ...(snippet.constraints.appExclude ? { appExclude: [...snippet.constraints.appExclude] } : {}),
          ...(snippet.constraints.localeHints ? { localeHints: [...snippet.constraints.localeHints] } : {})
        }
      } : {}),
      ...(snippet.tags ? { tags: [...snippet.tags] } : {}),
      ...(snippet.origin ? { origin: { ...snippet.origin } } : {})
    };
  }

  private cloneDerivedState(derived: SnippetDocument['derived']): SnippetDocument['derived'] {
    // Deep clone structured elements of derived state (like preview, diagnostics, exportImpact)
    // to prevent retrospective mutation of historical snapshots by subsequent runs.
    return {
      ...derived,
      ...(derived.preview ? {
        preview: {
          ...derived.preview,
          ...(derived.preview.warnings ? { warnings: [...derived.preview.warnings] } : {}),
          ...(derived.preview.trace ? { trace: [...derived.preview.trace] } : {})
        }
      } : {}),
      ...(derived.diagnostics ? {
        diagnostics: {
          ...derived.diagnostics,
          ...(derived.diagnostics.triggerCollisions ? { triggerCollisions: [...derived.diagnostics.triggerCollisions] } : {}),
          ...(derived.diagnostics.ambiguousBoundaries ? { ambiguousBoundaries: [...derived.diagnostics.ambiguousBoundaries] } : {}),
          ...(derived.diagnostics.encodingIssues ? { encodingIssues: [...derived.diagnostics.encodingIssues] } : {}),
          ...(derived.diagnostics.unsupportedFeatures ? { unsupportedFeatures: [...derived.diagnostics.unsupportedFeatures] } : {})
        }
      } : {}),
      ...(derived.exportImpact ? {
        // exportImpact is flat primitive numbers, spreading is sufficient for a new object reference
        exportImpact: { ...derived.exportImpact }
      } : {})
    };
  }

  private restoreSnapshot(workspace: Workspace, snapshot: WorkspaceStateSnapshot): void {
    workspace.activeDocumentId = snapshot.activeDocumentId;
    workspace.snippetSets = snapshot.snippetSets;
  }
}
