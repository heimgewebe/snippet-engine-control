/**
 * Benchmark for PreviewService.
 * This is intended for manual performance verification and not part of the standard CI test suite.
 */
import test from 'node:test';
import { Workspace, SnippetSet, SnippetDocument } from '../src/model/workspace';
import { PreviewService } from '../src/services/preview';

function createLargeWorkspace(numSets: number, numSnippetsPerSet: number): Workspace {
  const snippetSets: SnippetSet[] = [];
  let lastStableId = '';

  for (let i = 0; i < numSets; i++) {
    const snippets: SnippetDocument[] = [];
    for (let j = 0; j < numSnippetsPerSet; j++) {
      const stableId = `stable-${i}-${j}`;
      lastStableId = stableId;
      snippets.push({
        stableId,
        revisionId: `rev-${i}-${j}`,
        ir: { id: `id-${i}-${j}`, triggers: [`!t${i}-${j}`], body: 'body' },
        dirty: false,
        derived: {}
      });
    }
    snippetSets.push({
      id: `set-${i}`,
      name: `set-${i}`,
      source: { type: 'engine', path: `path-${i}` },
      snippets
    });
  }

  const docIndex = new Map<string, SnippetDocument>();
  for (const set of snippetSets) {
    for (const doc of set.snippets) {
      docIndex.set(doc.stableId, doc);
    }
  }

  return {
    id: 'ws-1',
    engineTarget: 'espanso',
    snippetSets,
    activeDocumentId: lastStableId, // Set the last one as active to force worst-case search
    diagnostics: { globalErrors: [], documentDiagnostics: {} },
    previewState: { results: {} },
    exportState: {},
    runtimeState: { isRunning: true },
    history: { undoStack: [], redoStack: [] },
    docIndex
  };
}

test('PreviewService Benchmark', async (t) => {
  const numSets = 100;
  const numSnippetsPerSet = 100;
  const workspace = createLargeWorkspace(numSets, numSnippetsPerSet);
  const service = new PreviewService();

  const iterations = 1000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    service.previewWorkspaceContext(workspace);
  }
  const end = performance.now();

  console.log(`\nBenchmark Results (${numSets * numSnippetsPerSet} snippets, ${iterations} iterations):`);
  console.log(`Total time: ${(end - start).toFixed(2)}ms`);
  console.log(`Average time per call: ${((end - start) / iterations).toFixed(4)}ms`);
});
