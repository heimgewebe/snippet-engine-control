import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { SnippetStore } from '../src/model/store';
import { DraftService } from '../src/services/draft';

test('DraftService', async (t) => {
  await t.test('saves new draft correctly', (t) => {
    const store = new SnippetStore();
    const putMock = t.mock.method(store, 'put');
    const service = new DraftService(store);

    const draft = {
      triggers: ['test'],
      body: 'test body'
    };

    const result = service.saveDraft(draft);

    // Verify interaction with mock
    assert.equal(putMock.mock.callCount(), 1);
    assert.deepEqual(putMock.mock.calls[0].arguments, [draft, undefined]);

    // Verify properties of the returned SnippetDocument (which in this case comes from real SnippetStore.put via the spy)
    assert.ok(result.stableId);
    assert.ok(result.revisionId);
    assert.equal(result.ir.triggers[0], 'test');
    assert.equal(result.dirty, true);
  });

  await t.test('updates existing draft correctly', (t) => {
    const store = new SnippetStore();
    const putMock = t.mock.method(store, 'put');
    const service = new DraftService(store);

    const draft = {
      triggers: ['test'],
      body: 'updated body'
    };
    const oldStableId = 'some-stable-id';

    // Since we are mocking put, and it's a spy (default behavior of t.mock.method(obj, method)),
    // it still calls the original method. But for update, we need a valid stableId in the store
    // or the real SnippetStore will throw.
    // So we'll preload the store with one snippet.
    const initialSnippet = { id: 'init', triggers: [':init'], body: 'init' };
    store.load([initialSnippet]);
    const existingDoc = store.getAll()[0];

    const result = service.saveDraft(draft, existingDoc.stableId);

    // Verify interaction with mock
    assert.equal(putMock.mock.callCount(), 1);
    assert.deepEqual(putMock.mock.calls[0].arguments, [draft, existingDoc.stableId]);

    // Verify the update reflected in the result
    assert.equal(result.stableId, existingDoc.stableId);
    assert.equal(result.ir.body, 'updated body');
    assert.equal(result.dirty, true);
  });
});
