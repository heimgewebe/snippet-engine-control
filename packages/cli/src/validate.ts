import { readSnippets, readSnippetsFromEspanso } from '@snippet-engine-control/adapter-espanso';
import { normalize, analyzeConflicts, analyzeBoundaries, analyzeEncoding } from '@snippet-engine-control/core';

export interface ValidateOptions {
  inputPath?: string;
  engine?: string;
  dir?: string;
}

export function validate(options: ValidateOptions | string = {}) {
  console.log('Validating snippets...');

  const opts = typeof options === 'string' ? { inputPath: options } : options;

  let snippets;
  try {
    if (opts.engine === 'espanso') {
      snippets = readSnippetsFromEspanso(opts.dir);
    } else {
      snippets = readSnippets(opts.inputPath);
    }
  } catch (error) {
    console.error(`Input error: ${(error as Error).message}`);
    process.exit(2);
  }

  const encodingDiag = analyzeEncoding(snippets); // Encoding on raw to catch CRLF

  const normalizedSnippets = snippets.map(normalize);

  const conflictsDiag = analyzeConflicts(normalizedSnippets);
  const boundariesDiag = analyzeBoundaries(normalizedSnippets);

  // Accumulate diagnostics
  const allCollisions = conflictsDiag.triggerCollisions;
  const allAmbiguous = boundariesDiag.ambiguousBoundaries;
  const allEncoding = encodingDiag.encodingIssues;

  let hasErrors = false;

  const formatIssue = (issue: string, snippetId?: string) => {
    // Find all snippets involved in this issue to extract paths
    const matchedPaths = new Set<string>();

    if (snippetId) {
      const s = normalizedSnippets.find(s => s.id === snippetId);
      if (s?.origin?.path) matchedPaths.add(s.origin.path);
    }

    // Check for "Snippet 'id'" format from boundary/encoding analyzers
    const snippetMatchRegex = /Snippet\s+'([^']+)'/g;
    let match;
    while ((match = snippetMatchRegex.exec(issue)) !== null) {
      const id = match[1];
      const s = normalizedSnippets.find(s => s.id === id);
      if (s?.origin?.path) matchedPaths.add(s.origin.path);
    }

    // Check for "used by ids: a, b" format from conflict analyzer
    const idsMatch = issue.match(/used by ids:\s*([^\n]+)/);
    if (idsMatch && idsMatch[1]) {
      const ids = idsMatch[1].split(',').map(id => id.trim());
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

  if (allCollisions.length > 0) {
    console.error('Validation failed: Trigger collisions found:');
    allCollisions.forEach((collision: string) => {
      console.error(`- ${formatIssue(collision)}`);
    });
    hasErrors = true;
  }

  if (allAmbiguous.length > 0) {
    console.warn('Warnings: Ambiguous boundaries found:');
    allAmbiguous.forEach((issue: string) => {
      console.warn(`- ${formatIssue(issue)}`);
    });
  }

  if (allEncoding.length > 0) {
    console.warn('Warnings: Encoding issues found:');
    allEncoding.forEach((issue: string) => {
      console.warn(`- ${formatIssue(issue)}`);
    });
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log('OK');
  process.exit(0);
}
