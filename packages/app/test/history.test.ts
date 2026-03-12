import test from 'node:test';
import * as assert from 'node:assert/strict';
import { HistoryService } from '../src/services/history';
import { Workspace } from '../src/model/workspace';
import { Snippet } from '@snippet-engine-control/core';

function createMockWorkspace(): Workspace {
  return {
    id: 'ws-1',
    engineTarget: 'espanso',
    snippetSets: [
      {
        id: 'set-1',
        name: 'default',
        source: { type: 'file', path: '/test/match/sec.generated.yml' },
        snippets: [
          {
            stableId: 'doc-1',
            revisionId: 'rev-1',
            dirty: false,
            ir: { id: 'rev-1', triggers: ['!hello'], body: 'Hello world' },
            derived: {}
          }
        ]
      }
    ],
    activeDocumentId: 'doc-1',
    diagnostics: { globalErrors: [], documentDiagnostics: {} },
    previewState: { results: {} },
    exportState: {},
    runtimeState: { isRunning: true },
    history: { undoStack: [], redoStack: [] }
  };
}

test('HistoryService', async (t) => {
  await t.test('pushState saves deep copy and clears redoStack', () => {
    const service = new HistoryService();
    const ws = createMockWorkspace();

    // add some garbage to redoStack to verify it clears
    ws.history.redoStack.push({ snippetSets: [] });

    service.pushState(ws);

    assert.equal(ws.history.undoStack.length, 1, 'Undo stack has 1 item');
    assert.equal(ws.history.redoStack.length, 0, 'Redo stack is cleared');

    const snapshot = ws.history.undoStack[0];
    assert.equal(snapshot.activeDocumentId, 'doc-1');
    assert.equal(snapshot.snippetSets[0].snippets[0].ir.body, 'Hello world');

    // Verify it is a deep copy: mutatiing ws should not affect snapshot
    ws.snippetSets[0].snippets[0].ir.body = 'Mutated';
    assert.equal(snapshot.snippetSets[0].snippets[0].ir.body, 'Hello world');
  });

  await t.test('undo restores previous state and pushes to redoStack', () => {
    const service = new HistoryService();
    const ws = createMockWorkspace();

    // push initial state
    service.pushState(ws);

    // make a change
    ws.snippetSets[0].snippets[0].ir.body = 'Changed';

    // undo
    const didUndo = service.undo(ws);

    assert.equal(didUndo, true, 'Undo was successful');
    assert.equal(ws.history.undoStack.length, 0, 'Undo stack is empty');
    assert.equal(ws.history.redoStack.length, 1, 'Redo stack has 1 item');
    assert.equal(ws.snippetSets[0].snippets[0].ir.body, 'Hello world', 'State was restored');

    // The current state before undoing should be in redoStack
    const redoSnapshot = ws.history.redoStack[0];
    assert.equal(redoSnapshot.snippetSets[0].snippets[0].ir.body, 'Changed');
  });

  await t.test('redo restores next state and pushes to undoStack', () => {
    const service = new HistoryService();
    const ws = createMockWorkspace();

    // push initial state
    service.pushState(ws);

    // make a change
    ws.snippetSets[0].snippets[0].ir.body = 'Changed';

    // undo
    service.undo(ws);

    // verify state is "Hello world"
    assert.equal(ws.snippetSets[0].snippets[0].ir.body, 'Hello world');

    // redo
    const didRedo = service.redo(ws);

    assert.equal(didRedo, true, 'Redo was successful');
    assert.equal(ws.history.undoStack.length, 1, 'Undo stack has 1 item');
    assert.equal(ws.history.redoStack.length, 0, 'Redo stack is empty');
    assert.equal(ws.snippetSets[0].snippets[0].ir.body, 'Changed', 'State was restored to redone version');
  });

  await t.test('undo / redo on empty stacks return false', () => {
    const service = new HistoryService();
    const ws = createMockWorkspace();

    assert.equal(service.undo(ws), false, 'Undo on empty stack returns false');
    assert.equal(service.redo(ws), false, 'Redo on empty stack returns false');
  });
});
