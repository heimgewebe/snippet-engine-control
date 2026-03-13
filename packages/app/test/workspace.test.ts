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

  await t.test('returns empty results without calling readSnippets when inputPath is omitted and engine is not espanso', () => {
    const service = new WorkspaceService({
      readSnippets: () => { throw new Error('Should not be called because inputPath is missing'); },
      readSnippetsFromEngine: () => { throw new Error('Should not be called'); }
    });

    const result = service.validate({});
    assert.strictEqual(result.hasErrors, false);
    assert.strictEqual(result.collisions.length, 0);
  });

  await t.test('openWorkspace() normalizes document identity via fingerprint', () => {
    const service = new WorkspaceService({
      readSnippets: () => [
        { id: 'some-random-engine-id', triggers: ['!test'], body: 'Test body' }
      ],
      readSnippetsFromEngine: () => []
    });

    // Provide inputPath so that loadSnippets bypasses the empty fallback
    const ws = service.openWorkspace({ inputPath: 'test' });
    const doc = ws.snippetSets[0].snippets[0];

    assert.notEqual(doc.revisionId, 'some-random-engine-id', 'revisionId should be computed from fingerprint, not raw ID');
    assert.equal(doc.ir.id, doc.revisionId, 'ir.id must be normalized to equal revisionId');
    assert.equal(doc.dirty, false);
  });

  await t.test('updateDocument() handles actual updates, no-ops, and unknown stableIds correctly', () => {
    const service = new WorkspaceService({
      readSnippets: () => [
        { id: 'raw', triggers: ['!test'], body: 'Test body' }
      ],
      readSnippetsFromEngine: () => []
    });

    const ws = service.openWorkspace({ inputPath: 'test' });
    const doc = ws.snippetSets[0].snippets[0];
    const initialRevisionId = doc.revisionId;

    assert.equal(ws.history.undoStack.length, 0);
    assert.equal(ws.history.redoStack.length, 0);

    // D: No-op update generates no history
    const noOpResult = service.updateDocument(ws, doc.stableId, doc.ir);
    assert.equal(noOpResult, false, 'No-op should return false');
    assert.equal(ws.history.undoStack.length, 0, 'No history should be pushed for no-op');

    // C: Unknown stableId generates no history
    const unknownResult = service.updateDocument(ws, 'unknown-stable-id', doc.ir);
    assert.equal(unknownResult, false, 'Unknown stableId should return false');
    assert.equal(ws.history.undoStack.length, 0, 'No history should be pushed for unknown stableId');

    // B: Real update changes revisionId, synchronizes ir.id, and pushes history
    const updatedIr = { id: 'will-be-overwritten', triggers: ['!test2'], body: 'New body' };
    const realResult = service.updateDocument(ws, doc.stableId, updatedIr);

    assert.equal(realResult, true, 'Real update should return true');
    assert.equal(ws.history.undoStack.length, 1, 'History pushed for actual mutation');

    const updatedDoc = ws.snippetSets[0].snippets[0];
    assert.notEqual(updatedDoc.revisionId, initialRevisionId, 'revisionId should change for mutated content');
    assert.equal(updatedDoc.ir.id, updatedDoc.revisionId, 'ir.id must be synchronized with new revisionId');
    assert.notEqual(updatedDoc.ir.id, 'will-be-overwritten', 'Provided dummy ID should be replaced by fingerprint');
    assert.equal(updatedDoc.dirty, true, 'Document should be marked dirty');

    // Verify undo/redo logic
    service.undo(ws);
    assert.equal(ws.history.undoStack.length, 0);
    assert.equal(ws.history.redoStack.length, 1);
    const revertedDoc = ws.snippetSets[0].snippets[0];
    assert.equal(revertedDoc.revisionId, initialRevisionId, 'revisionId restored');

    service.redo(ws);
    assert.equal(ws.history.undoStack.length, 1);
    assert.equal(ws.history.redoStack.length, 0);
  });

  await t.test('selectDocument does NOT create history entry', () => {
    const service = new WorkspaceService({
      readSnippets: () => [
        { id: '1', triggers: ['!hello'], body: 'Hello world' },
        { id: '2', triggers: ['!bye'], body: 'Goodbye' }
      ],
      readSnippetsFromEngine: () => []
    });

    const ws = service.openWorkspace({ inputPath: 'test' });
    const doc2 = ws.snippetSets[0].snippets[1];

    service.selectDocument(ws, doc2.stableId);
    assert.equal(ws.activeDocumentId, doc2.stableId);
    assert.equal(ws.history.undoStack.length, 0, 'Selection should not pollute history');
  });

  await t.test('update after undo clears redoStack', () => {
    const service = new WorkspaceService({
      readSnippets: () => [
        { id: '1', triggers: ['!hello'], body: 'Hello world' }
      ],
      readSnippetsFromEngine: () => []
    });

    const ws = service.openWorkspace({ inputPath: 'test' });
    const doc = ws.snippetSets[0].snippets[0];

    service.updateDocument(ws, doc.stableId, { id: 'dummy1', triggers: ['!hello'], body: 'Update 1' });
    service.undo(ws);

    assert.equal(ws.history.redoStack.length, 1, 'redoStack should have one entry');

    service.updateDocument(ws, doc.stableId, { id: 'dummy2', triggers: ['!hello'], body: 'Divergent Update 2' });

    assert.equal(ws.history.redoStack.length, 0, 'redoStack should be cleared after a diverging mutation');
  });
});
