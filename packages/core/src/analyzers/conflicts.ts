import { Snippet } from '../model/snippet';
import { Diagnostics } from '../model/diagnostics';

export function analyzeConflicts(snippets: Snippet[]): Diagnostics {
  const diagnostics: Diagnostics = {
    triggerCollisions: [],
    ambiguousBoundaries: [],
    encodingIssues: [],
    unsupportedFeatures: []
  };

  const triggerMap = new Map<string, string[]>();

  for (const snippet of snippets) {
    for (const trigger of snippet.triggers) {
      if (!triggerMap.has(trigger)) {
        triggerMap.set(trigger, []);
      }
      triggerMap.get(trigger)!.push(snippet.id);
    }
  }

  for (const [trigger, ids] of triggerMap.entries()) {
    if (ids.length > 1) {
      diagnostics.triggerCollisions.push(`trigger '${trigger}' used by ids: ${ids.join(',')}`);
    }
  }

  return diagnostics;
}
