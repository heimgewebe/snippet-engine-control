import { Snippet, normalize, analyzeConflicts, analyzeBoundaries, analyzeEncoding } from '@snippet-engine-control/core';

export interface ValidationResult {
  hasErrors: boolean;
  collisions: string[];
  ambiguous: string[];
  encoding: string[];
}

export class ValidationService {
  public validateSnippets(snippets: Snippet[]): ValidationResult {
    const encodingDiag = analyzeEncoding(snippets);
    const normalizedSnippets = snippets.map(normalize);
    const conflictsDiag = analyzeConflicts(normalizedSnippets);
    const boundariesDiag = analyzeBoundaries(normalizedSnippets);

    const formatIssue = (issue: string, snippetId?: string) => {
      const matchedPaths = new Set<string>();

      if (snippetId) {
        const s = normalizedSnippets.find(s => s.id === snippetId);
        if (s?.origin?.path) matchedPaths.add(s.origin.path);
      }

      const snippetMatchRegex = /Snippet\s+'([^']+)'/g;
      let match;
      while ((match = snippetMatchRegex.exec(issue)) !== null) {
        const id = match[1];
        const s = normalizedSnippets.find(s => s.id === id);
        if (s?.origin?.path) matchedPaths.add(s.origin.path);
      }

      const idsMatch = issue.match(/used by ids:\s*([^\n]+)/);
      if (idsMatch && idsMatch[1]) {
        const ids = idsMatch[1].split(',').map(id => id.trim()).filter(id => id.length > 0);
        ids.forEach(id => {
          const s = normalizedSnippets.find(s => s.id === id);
          if (s?.origin?.path) matchedPaths.add(s.origin.path);
        });
      }

      if (matchedPaths.size > 0) {
        return `${issue} (paths: ${Array.from(matchedPaths).join(', ')})`;
      }
      return issue;
    };

    const collisions = conflictsDiag.triggerCollisions.map((i: string) => formatIssue(i));
    const ambiguous = boundariesDiag.ambiguousBoundaries.map((i: string) => formatIssue(i));
    const encoding = encodingDiag.encodingIssues.map((i: string) => formatIssue(i));

    return {
      hasErrors: collisions.length > 0,
      collisions,
      ambiguous,
      encoding
    };
  }
}
