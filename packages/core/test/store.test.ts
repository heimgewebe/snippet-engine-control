import test from 'node:test';
import * as assert from 'node:assert/strict';
import { SnippetStore } from '../src/model/store';
import { Snippet } from '../src/model/snippet';

test('SnippetStore CRUD', () => {
  const store = new SnippetStore();

  const initial: Snippet = {
    id: 'abc',
    triggers: [':test'],
    body: 'Test body',
  };

  // Load
  store.load([initial]);
  assert.equal(store.getAll().length, 1);
  assert.equal(store.get('abc')?.body, 'Test body');

  // Put (update)
  const updatedDraft: Omit<Snippet, 'id'> = {
    triggers: [':test', ':alias'],
    body: 'Updated body'
  };
  const saved = store.put(updatedDraft, 'abc');

  // Verify deterministic ID changed since content changed
  assert.notEqual(saved.id, 'abc');
  assert.equal(saved.body, 'Updated body');

  // Verify old was deleted
  assert.equal(store.get('abc'), undefined);

  // Verify new exists
  assert.equal(store.get(saved.id)?.body, 'Updated body');

  // Delete
  assert.equal(store.delete(saved.id), true);
  assert.equal(store.getAll().length, 0);
});
