import { Snippet } from './snippet';
import { fingerprint } from '../ir/fingerprint';

export class SnippetStore {
  private map: Map<string, Snippet> = new Map();

  /**
   * Initializes the store with a list of snippets.
   * Useful when loading snippets from an adapter (e.g., readSnippetsFromEspanso).
   */
  public load(snippets: Snippet[]): void {
    this.map.clear();
    for (const snippet of snippets) {
      this.map.set(snippet.id, snippet);
    }
  }

  /**
   * Retrieves all snippets as an array.
   */
  public getAll(): Snippet[] {
    return Array.from(this.map.values());
  }

  /**
   * Retrieves a single snippet by ID.
   */
  public get(id: string): Snippet | undefined {
    return this.map.get(id);
  }

  /**
   * Upserts a snippet into the store.
   * If the ID is new or changes (due to content change), it will regenerate the fingerprint,
   * save it, and delete the old entry if the ID changed.
   * @param snippet - The snippet object to update/insert.
   * @param oldId - Optional original ID if editing an existing snippet, to ensure it gets removed if its ID changes.
   * @returns The saved snippet with its current deterministic ID.
   */
  public put(snippet: Omit<Snippet, 'id'>, oldId?: string): Snippet {
    const newId = fingerprint(snippet as Snippet).substring(0, 12);
    const updatedSnippet: Snippet = {
      ...snippet,
      id: newId
    };

    if (oldId && oldId !== newId) {
      this.map.delete(oldId);
    }

    this.map.set(newId, updatedSnippet);
    return updatedSnippet;
  }

  /**
   * Removes a snippet from the store.
   */
  public delete(id: string): boolean {
    return this.map.delete(id);
  }
}
