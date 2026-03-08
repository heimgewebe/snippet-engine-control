import test from 'node:test';
import * as assert from 'node:assert/strict';
import { SnippetStore } from '../src/model/store';
import { Snippet } from '@snippet-engine-control/core';

test('SnippetStore CRUD', () => {
  const store = new SnippetStore();

  const initial: Snippet = {
    id: 'abc',
    triggers: [':test'],
    body: 'Test body',
  };

  // Load generates stableIds and revisionIds
  store.load([initial]);
  const docs = store.getAll();
  assert.equal(docs.length, 1);

  const doc = docs[0];
  assert.equal(doc.ir.body, 'Test body');
  assert.equal(doc.dirty, false);
  assert.ok(doc.stableId);
  assert.ok(doc.revisionId);

  // Put (update via edit)
  const updatedDraft: Omit<Snippet, 'id'> = {
    triggers: [':test', ':alias'],
    body: 'Updated body'
  };

  // Updating existing document by stableId
  const saved = store.put(updatedDraft, doc.stableId);

  assert.equal(saved.stableId, doc.stableId, 'Stable ID should not change');
  assert.notEqual(saved.revisionId, doc.revisionId, 'Revision ID should change due to new content');
  assert.equal(saved.ir.body, 'Updated body');
  assert.equal(saved.dirty, true, 'Updating should mark it as dirty');

  // Verify retrieval
  assert.equal(store.get(doc.stableId)?.ir.body, 'Updated body');

  // Add new
  const newSnippetDraft: Omit<Snippet, 'id'> = {
    triggers: [':new'],
    body: 'New body'
  };
  const added = store.put(newSnippetDraft);
  assert.ok(added.stableId);
  assert.equal(added.ir.body, 'New body');
  assert.equal(added.dirty, true, 'New snippets should be marked dirty');

  assert.equal(store.getAll().length, 2);

  // Unknown oldStableId throws
  assert.throws(() => {
    store.put(updatedDraft, 'non-existent-id');
  }, /Unknown stableId: non-existent-id/);

  // Delete
  assert.equal(store.delete(saved.stableId), true);
  assert.equal(store.getAll().length, 1);
});
