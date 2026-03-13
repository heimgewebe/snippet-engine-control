import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceService } from '../src/services/workspace';
import { Snippet } from '@snippet-engine-control/core';

test('WorkspaceService', async (t) => {
  await t.test('initializes and validates without errors on empty', () => {
    const service = new WorkspaceService({
      readSnippets: () => [],
      readSnippetsFromEngine: () => []
    });

    const result = service.validate({ inputPath: 'test' });
    assert.strictEqual(result.hasErrors, false);
    assert.strictEqual(result.collisions.length, 0);
  });

  await t.test('calls readSnippets correctly when inputPath is omitted and engine is not espanso', () => {
    let wasCalled = false;
    const service = new WorkspaceService({
      readSnippets: (path) => {
        assert.strictEqual(path, undefined);
        wasCalled = true;
        return [];
      },
      readSnippetsFromEngine: () => { throw new Error('Should not be called'); }
    });

    service.validate({});
    assert.strictEqual(wasCalled, true);
  });

  await t.test('workspace flow (open, select, update, undo, redo)', () => {
    const service = new WorkspaceService({
      readSnippets: () => [
        { id: '1', triggers: ['!hello'], body: 'Hello world' },
        { id: '2', triggers: ['!bye'], body: 'Goodbye' }
      ],
      readSnippetsFromEngine: () => []
    });

    // 1. Open Workspace
    const ws = service.openWorkspace({});
    assert.equal(ws.snippetSets.length, 1);
    assert.equal(ws.snippetSets[0].snippets.length, 2);

    const doc1 = ws.snippetSets[0].snippets[0];
    const doc2 = ws.snippetSets[0].snippets[1];

    assert.equal(ws.activeDocumentId, doc1.stableId);

    // 2. Select Document (does NOT create history entry, just selection)
    service.selectDocument(ws, doc2.stableId);
    assert.equal(ws.activeDocumentId, doc2.stableId);
    assert.equal(ws.history.undoStack.length, 0);

    // 3. Update Document (creates history entry)
    const updatedIr = { id: '2', triggers: ['!bye'], body: 'Goodbye World' };
    service.updateDocument(ws, doc2.stableId, updatedIr);

    const updatedDoc2 = ws.snippetSets[0].snippets.find(s => s.stableId === doc2.stableId);
    assert.equal(updatedDoc2?.ir.body, 'Goodbye World');
    assert.equal(updatedDoc2?.dirty, true);
    assert.equal(ws.history.undoStack.length, 1);

    // 4. Undo Update
    const undoSuccess = service.undo(ws);
    assert.equal(undoSuccess, true);

    const revertedDoc2 = ws.snippetSets[0].snippets.find(s => s.stableId === doc2.stableId);
    assert.equal(revertedDoc2?.ir.body, 'Goodbye'); // should be back to original
    assert.equal(ws.history.redoStack.length, 1);

    // 5. Redo Update
    const redoSuccess = service.redo(ws);
    assert.equal(redoSuccess, true);

    const redoneDoc2 = ws.snippetSets[0].snippets.find(s => s.stableId === doc2.stableId);
    assert.equal(redoneDoc2?.ir.body, 'Goodbye World'); // should be updated again
    assert.equal(ws.history.redoStack.length, 0);

    // 6. Update after undo clears redoStack
    service.undo(ws);
    assert.equal(ws.history.redoStack.length, 1);
    const updatedIr2 = { id: '2', triggers: ['!bye'], body: 'Brand New Goodbye' };
    service.updateDocument(ws, doc2.stableId, updatedIr2);
    assert.equal(ws.history.redoStack.length, 0, 'redoStack should be cleared after a new diverging action');
  });
});
