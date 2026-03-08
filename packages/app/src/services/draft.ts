import { Snippet } from '@snippet-engine-control/core';
import { SnippetStore } from '../model/store';
import { SnippetDocument } from '../model/workspace';

export class DraftService {
  constructor(private store: SnippetStore) {}

  public saveDraft(snippet: Omit<Snippet, 'id'>, oldStableId?: string): SnippetDocument {
    return this.store.put(snippet, oldStableId);
  }
}
