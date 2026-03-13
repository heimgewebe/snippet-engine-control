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
});
