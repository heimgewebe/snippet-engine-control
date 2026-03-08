import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { SnippetStore } from '../src/model/store';
import { DraftService } from '../src/services/draft';

test('DraftService', async (t) => {
  await t.test('saves new draft correctly', () => {
    const store = new SnippetStore();
    const service = new DraftService(store);

    const draft = {
      triggers: ['test'],
      body: 'test body'
    };

    const result = service.saveDraft(draft);

    assert.ok(result.stableId);
    assert.ok(result.revisionId);
    assert.equal(result.ir.triggers[0], 'test');
    assert.equal(result.dirty, true);

    // verify it was added to store
    const inStore = store.get(result.stableId);
    assert.ok(inStore);
    assert.equal(inStore?.stableId, result.stableId);
  });

  await t.test('updates existing draft correctly', () => {
    const store = new SnippetStore();
    const service = new DraftService(store);

    const draft1 = {
      triggers: ['test'],
      body: 'test body 1'
    };

    const first = service.saveDraft(draft1);

    const draft2 = {
      triggers: ['test'],
      body: 'updated body'
    };

    const result = service.saveDraft(draft2, first.stableId);

    assert.equal(result.stableId, first.stableId, 'Stable ID should not change on update');
    assert.notEqual(result.revisionId, first.revisionId, 'Revision ID should change on content update');
    assert.equal(result.ir.body, 'updated body');
    assert.equal(result.dirty, true);

    const inStore = store.get(first.stableId);
    assert.equal(inStore?.ir.body, 'updated body');
  });
});
