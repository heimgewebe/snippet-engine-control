import { readSnippets } from '@snippet-engine-control/adapter-espanso';
import { analyzeConflicts } from '@snippet-engine-control/core';

export function validate() {
  console.log('Validating snippets...');

  let snippets;
  try {
    const inputPath = process.env.SEC_SNIPPETS;
    snippets = readSnippets(inputPath);
  } catch (error) {
    console.error(`Input error: ${(error as Error).message}`);
    process.exit(2);
  }

  const diagnostics = analyzeConflicts(snippets);

  if (diagnostics.triggerCollisions.length > 0) {
    console.error('Validation failed: Trigger collisions found:');
    diagnostics.triggerCollisions.forEach(collision => {
      console.error(`- ${collision}`);
    });
    process.exit(1);
  }

  console.log('OK');
  process.exit(0);
}
