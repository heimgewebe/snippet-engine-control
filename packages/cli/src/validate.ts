import { readSnippets } from '@snippet-engine-control/adapter-espanso';
import { normalize, analyzeConflicts, analyzeBoundaries, analyzeEncoding } from '@snippet-engine-control/core';

export function validate(inputPath?: string) {
  console.log('Validating snippets...');

  let snippets;
  try {
    snippets = readSnippets(inputPath);
  } catch (error) {
    console.error(`Input error: ${(error as Error).message}`);
    process.exit(2);
  }

  const normalizedSnippets = snippets.map(normalize);

  const conflictsDiag = analyzeConflicts(normalizedSnippets);
  const boundariesDiag = analyzeBoundaries(normalizedSnippets);
  const encodingDiag = analyzeEncoding(normalizedSnippets);

  // Accumulate diagnostics
  const allCollisions = conflictsDiag.triggerCollisions.concat(boundariesDiag.triggerCollisions, encodingDiag.triggerCollisions);
  const allAmbiguous = conflictsDiag.ambiguousBoundaries.concat(boundariesDiag.ambiguousBoundaries, encodingDiag.ambiguousBoundaries);
  const allEncoding = conflictsDiag.encodingIssues.concat(boundariesDiag.encodingIssues, encodingDiag.encodingIssues);

  let hasErrors = false;

  if (allCollisions.length > 0) {
    console.error('Validation failed: Trigger collisions found:');
    allCollisions.forEach((collision: string) => {
      console.error(`- ${collision}`);
    });
    hasErrors = true;
  }

  if (allAmbiguous.length > 0) {
    console.warn('Warnings: Ambiguous boundaries found:');
    allAmbiguous.forEach((issue: string) => {
      console.warn(`- ${issue}`);
    });
  }

  if (allEncoding.length > 0) {
    console.warn('Warnings: Encoding issues found:');
    allEncoding.forEach((issue: string) => {
      console.warn(`- ${issue}`);
    });
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log('OK');
  process.exit(0);
}
