import { EngineReadPort } from '../ports/engine';
import { Snippet } from '@snippet-engine-control/core';
import { ValidationService, ValidationResult } from './validation';

export interface ValidateOptions {
  inputPath?: string;
  engine?: string;
  dir?: string;
}

import * as crypto from 'crypto';
import { Workspace, SnippetDocument } from '../model/workspace';
import { HistoryService } from './history';
import { fingerprint } from '@snippet-engine-control/core';

export class WorkspaceService {
  private historyService: HistoryService;

  constructor(private engine: EngineReadPort) {
    this.historyService = new HistoryService();
  }

  private calculateRevisionId(snippet: Snippet): string {
    const { id, ...content } = snippet;
    return fingerprint(content as unknown as Snippet).substring(0, 12);
  }

  public openWorkspace(options: ValidateOptions): Workspace {
    const snippets = this.loadSnippets(options);

    const snippetSets = [
      {
        id: crypto.randomUUID(),
        name: 'default',
        source: { type: 'engine', path: options.dir || 'default' },
        snippets: snippets.map((s) => {
          const revisionId = this.calculateRevisionId(s);
          const normalizedIr = { ...s, id: revisionId };

          return {
            stableId: crypto.randomUUID(),
            revisionId,
            ir: normalizedIr,
            dirty: false,
            derived: {}
          };
        })
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

  public addDocument(workspace: Workspace, draftIr: Snippet): SnippetDocument {
    if (workspace.snippetSets.length === 0) {
      throw new Error('Workspace has no snippet sets to add to.');
    }

    const revisionId = this.calculateRevisionId(draftIr);
    const normalizedIr = { ...draftIr, id: revisionId };

    const newDoc: SnippetDocument = {
      stableId: crypto.randomUUID(),
      revisionId,
      ir: normalizedIr,
      dirty: true,
      derived: {}
    };

    // Push to history before mutating
    this.historyService.pushState(workspace);

    // Add to the first set for now, or could be a target set depending on options
    workspace.snippetSets[0].snippets.push(newDoc);
    workspace.activeDocumentId = newDoc.stableId;

    return newDoc;
  }

  public deleteDocument(workspace: Workspace, stableId: string): boolean {
    for (const set of workspace.snippetSets) {
      const docIndex = set.snippets.findIndex(d => d.stableId === stableId);
      if (docIndex !== -1) {
        // Push to history before mutating
        this.historyService.pushState(workspace);
        set.snippets.splice(docIndex, 1);

        // Reset active document if it was the one deleted
        if (workspace.activeDocumentId === stableId) {
          workspace.activeDocumentId = undefined;
        }
        return true;
      }
    }
    return false; // Document not found
  }

  public updateDocument(workspace: Workspace, stableId: string, updatedIr: Snippet): boolean {
    for (const set of workspace.snippetSets) {
      const docIndex = set.snippets.findIndex(d => d.stableId === stableId);
      if (docIndex !== -1) {
        const existingDoc = set.snippets[docIndex];
        const newRevisionId = this.calculateRevisionId(updatedIr);

        // No-op update check: If the new revision matches the existing one, nothing effectively changed.
        if (existingDoc.revisionId === newRevisionId) {
          return false;
        }

        const normalizedIr = { ...updatedIr, id: newRevisionId };

        // Only push to history when an actual mutation takes place
        this.historyService.pushState(workspace);

        set.snippets[docIndex] = {
          ...existingDoc,
          revisionId: newRevisionId,
          ir: normalizedIr,
          dirty: true,
          derived: {} // clear derived state as it might be invalid now
        };
        return true;
      }
    }
    return false; // Document not found
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
      // Orchestration layer resolves environment defaults and decides whether to be tolerant.
      const inputPath = options.inputPath ?? process.env.SEC_SNIPPETS;
      if (!inputPath) {
        return [];
      }
      return this.engine.readSnippets(inputPath);
    }
  }

  public validate(options: ValidateOptions): ValidationResult {
    const snippets = this.loadSnippets(options);
    const validationService = new ValidationService();
    return validationService.validateSnippets(snippets);
  }
}
