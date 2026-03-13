import { EngineReadPort } from '../ports/engine';
import { Snippet } from '@snippet-engine-control/core';
import { ValidationService, ValidationResult } from './validation';

export interface ValidateOptions {
  inputPath?: string;
  engine?: string;
  dir?: string;
}

import { Workspace, SnippetDocument } from '../model/workspace';
import { HistoryService } from './history';
import * as crypto from 'crypto';

export class WorkspaceService {
  private historyService: HistoryService;

  constructor(private engine: EngineReadPort) {
    this.historyService = new HistoryService();
  }

  public openWorkspace(options: ValidateOptions): Workspace {
    const snippets = this.loadSnippets(options);

    const snippetSets = [
      {
        id: crypto.randomUUID(),
        name: 'default',
        source: { type: 'engine', path: options.dir || 'default' },
        snippets: snippets.map((s) => ({
          stableId: crypto.randomUUID(),
          revisionId: s.id,
          ir: s,
          dirty: false,
          derived: {}
        }))
      }
    ];

    return {
      id: crypto.randomUUID(),
      engineTarget: 'espanso',
      snippetSets,
      activeDocumentId: snippetSets[0]?.snippets[0]?.stableId,
      diagnostics: { globalErrors: [], documentDiagnostics: {} },
      previewState: { results: {} },
      exportState: {},
      runtimeState: { isRunning: true },
      history: { undoStack: [], redoStack: [] }
    };
  }

  public selectDocument(workspace: Workspace, stableId: string): void {
    workspace.activeDocumentId = stableId;
  }

  public updateDocument(workspace: Workspace, stableId: string, updatedIr: Snippet): void {
    this.historyService.pushState(workspace);

    for (const set of workspace.snippetSets) {
      const docIndex = set.snippets.findIndex(d => d.stableId === stableId);
      if (docIndex !== -1) {
        const existingDoc = set.snippets[docIndex];
        set.snippets[docIndex] = {
          ...existingDoc,
          ir: updatedIr,
          dirty: true,
          derived: {} // clear derived state as it might be invalid now
        };
        break;
      }
    }
  }

  public undo(workspace: Workspace): boolean {
    return this.historyService.undo(workspace);
  }

  public redo(workspace: Workspace): boolean {
    return this.historyService.redo(workspace);
  }

  public loadSnippets(options: ValidateOptions): Snippet[] {
    if (options.engine === 'espanso') {
      return this.engine.readSnippetsFromEngine(options.dir);
    } else {
      // allow options.inputPath to be undefined, as the adapter may have a default behavior or
      // rely on environment variables (like SEC_SNIPPETS) which we want to preserve.
      return this.engine.readSnippets(options.inputPath);
    }
  }

  public validate(options: ValidateOptions): ValidationResult {
    const snippets = this.loadSnippets(options);
    const validationService = new ValidationService();
    return validationService.validateSnippets(snippets);
  }
}
