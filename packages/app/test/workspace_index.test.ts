import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceService } from '../src/services/workspace';
import { Snippet } from '@snippet-engine-control/core';

test('WorkspaceService docIndex', async (t) => {
  const service = new WorkspaceService({
    readSnippets: () => [
      { id: '1', triggers: ['!hello'], body: 'Hello world' },
      { id: '2', triggers: ['!bye'], body: 'Goodbye' }
    ],
    readSnippetsFromEngine: () => []
  });

  await t.test('openWorkspace populates docIndex', () => {
    const ws = service.openWorkspace({ inputPath: 'test' });
    assert.strictEqual(ws.docIndex.size, 2);
    for (const set of ws.snippetSets) {
      for (const doc of set.snippets) {
        assert.strictEqual(ws.docIndex.get(doc.stableId), doc);
      }
    }
  });

  await t.test('addDocument updates docIndex', () => {
    const ws = service.openWorkspace({ inputPath: 'test' });
    const draftSnippet: Snippet = { id: 'new', triggers: ['!new'], body: 'New' };
    const newDoc = service.addDocument(ws, draftSnippet);
    assert.strictEqual(ws.docIndex.size, 3);
    assert.strictEqual(ws.docIndex.get(newDoc.stableId), newDoc);
  });

  await t.test('updateDocument updates docIndex', () => {
    const ws = service.openWorkspace({ inputPath: 'test' });
    const doc = ws.snippetSets[0].snippets[0];
    const updatedIr: Snippet = { ...doc.ir, body: 'Updated' };
    service.updateDocument(ws, doc.stableId, updatedIr);

    const updatedDoc = ws.snippetSets[0].snippets[0];
    assert.strictEqual(ws.docIndex.get(doc.stableId), updatedDoc);
    assert.notStrictEqual(ws.docIndex.get(doc.stableId), doc); // should be a new object
  });

  await t.test('deleteDocument updates docIndex', () => {
    const ws = service.openWorkspace({ inputPath: 'test' });
    const doc = ws.snippetSets[0].snippets[0];
    service.deleteDocument(ws, doc.stableId);
    assert.strictEqual(ws.docIndex.size, 1);
    assert.strictEqual(ws.docIndex.has(doc.stableId), false);
  });

  await t.test('undo/redo restores docIndex', () => {
    const ws = service.openWorkspace({ inputPath: 'test' });
    const doc = ws.snippetSets[0].snippets[0];
    const stableId = doc.stableId;

    service.deleteDocument(ws, stableId);
    assert.strictEqual(ws.docIndex.has(stableId), false);

    service.undo(ws);
    assert.strictEqual(ws.docIndex.has(stableId), true);
    assert.strictEqual(ws.docIndex.get(stableId)?.stableId, stableId);

    service.redo(ws);
    assert.strictEqual(ws.docIndex.has(stableId), false);
  });
});
