import { Snippet, simulateExpansion } from '@snippet-engine-control/core';

export class SnippetService {
  constructor() {}

  public preview(snippet: Snippet) {
    return simulateExpansion(snippet);
  }
}
