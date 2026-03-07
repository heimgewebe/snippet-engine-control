import { Snippet, fingerprint } from '@snippet-engine-control/core';
import { SnippetDocument } from './workspace';
import * as crypto from 'crypto';

export class SnippetStore {
  // Map keyed by stableId
  private map: Map<string, SnippetDocument> = new Map();

  /**
   * Initializes the store with a list of raw snippets.
   * Useful when loading snippets from an adapter (e.g., readSnippetsFromEspanso).
   * Generates a stableId for each and sets dirty to false.
   */
  public load(snippets: Snippet[]): void {
    this.map.clear();
    for (const snippet of snippets) {
      // In Phase 1 we just use a random UUID for stableId
      // and the fingerprint for revisionId
      const stableId = crypto.randomUUID();
      const revisionId = fingerprint(snippet).substring(0, 12);

      const doc: SnippetDocument = {
        stableId,
        revisionId,
        ir: snippet,
        dirty: false,
        derived: {}
      };

      this.map.set(stableId, doc);
    }
  }

  /**
   * Retrieves all SnippetDocuments as an array.
   */
  public getAll(): SnippetDocument[] {
    return Array.from(this.map.values());
  }

  /**
   * Retrieves a single SnippetDocument by stableId.
   */
  public get(stableId: string): SnippetDocument | undefined {
    return this.map.get(stableId);
  }

  /**
   * Upserts a snippet into the store.
   * If oldStableId is provided, updates the existing document.
   * If the content changes, updates revisionId and sets dirty = true.
   *
   * @param snippet - The snippet IR to update/insert.
   * @param oldStableId - Optional stableId if editing an existing snippet.
   * @returns The saved SnippetDocument.
   */
  public put(snippet: Omit<Snippet, 'id'>, oldStableId?: string): SnippetDocument {
    const revisionId = fingerprint(snippet as Snippet).substring(0, 12);

    // update the snippet IR id to match its new fingerprint ID to maintain compat
    const updatedSnippet: Snippet = {
      ...snippet,
      id: revisionId
    };

    if (oldStableId && this.map.has(oldStableId)) {
      // Update existing document
      const existing = this.map.get(oldStableId)!;

      const updatedDoc: SnippetDocument = {
        ...existing,
        revisionId,
        ir: updatedSnippet,
        dirty: true, // mark as dirty since it was updated
        // clear derived state that might be outdated
        derived: {
          ...existing.derived,
          diagnostics: undefined,
          preview: undefined
        }
      };

      this.map.set(oldStableId, updatedDoc);
      return updatedDoc;
    } else {
      // Create new document
      const stableId = crypto.randomUUID();
      const newDoc: SnippetDocument = {
        stableId,
        revisionId,
        ir: updatedSnippet,
        dirty: true, // true since it's newly created/unpersisted draft
        derived: {}
      };

      this.map.set(stableId, newDoc);
      return newDoc;
    }
  }

  /**
   * Removes a snippet document from the store by stableId.
   */
  public delete(stableId: string): boolean {
    return this.map.delete(stableId);
  }
}
