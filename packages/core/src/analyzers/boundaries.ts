// boundaries.ts
import { Snippet } from '../model/snippet';
import { Diagnostics } from '../model/diagnostics';

export function analyzeBoundaries(snippets: Snippet[]): Diagnostics {
  const diagnostics: Diagnostics = {
    triggerCollisions: [],
    ambiguousBoundaries: [],
    encodingIssues: [],
    unsupportedFeatures: []
  };

  for (const snippet of snippets) {
    if (snippet.constraints?.wordBoundary === true) {
      for (const trigger of snippet.triggers) {
        // Heuristic: alphanumeric without prefix might be ambiguous
        if (/^[a-zA-Z0-9]+$/.test(trigger)) {
          diagnostics.ambiguousBoundaries.push(`Snippet '${snippet.id}': Trigger '${trigger}' is alphanumeric and requires wordBoundary, which may be ambiguous.`);
        }
      }
    }
  }

  return diagnostics;
}
