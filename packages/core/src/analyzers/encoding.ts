// encoding.ts
import { Snippet } from '../model/snippet';
import { Diagnostics } from '../model/diagnostics';

export function analyzeEncoding(snippets: Snippet[]): Diagnostics {
  const diagnostics: Diagnostics = {
    triggerCollisions: [],
    ambiguousBoundaries: [],
    encodingIssues: [],
    unsupportedFeatures: []
  };

  for (const snippet of snippets) {
    if (snippet.body.includes('\0')) {
      diagnostics.encodingIssues.push(`Snippet '${snippet.id}': Body contains NUL character.`);
    }
    if (snippet.body.includes('\r\n')) {
      diagnostics.encodingIssues.push(`Snippet '${snippet.id}': Body contains CRLF line endings.`);
    }
  }

  return diagnostics;
}
