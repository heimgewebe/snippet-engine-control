import { Workspace, WorkspaceStateSnapshot, SnippetSet, SnippetDocument } from '../model/workspace';

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
      // Create a deep enough clone to preserve state but we can just map and spread
      // SnippetDocument and SnippetSet since they contain simple objects or arrays
      snippetSets: workspace.snippetSets.map(set => ({
        ...set,
        source: { ...set.source },
        snippets: set.snippets.map(doc => ({
          ...doc,
          ir: {
            ...doc.ir,
            triggers: [...doc.ir.triggers],
          },
          derived: {
            ...doc.derived
            // Deep cloning diagnostic and preview results isn't strictly necessary
            // as they are regenerated and treated as immutable, but we copy the object shell
          }
        }))
      }))
    };
  }

  private restoreSnapshot(workspace: Workspace, snapshot: WorkspaceStateSnapshot): void {
    workspace.activeDocumentId = snapshot.activeDocumentId;
    workspace.snippetSets = snapshot.snippetSets;
    // We should probably trigger a derived state invalidation or let ValidationService handle it,
    // but the snapshot contains the derived state of that exact moment.
  }
}
