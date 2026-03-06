import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceService } from '../src/services/workspace';

test('WorkspaceService', async (t) => {
  await t.test('initializes and validates without errors on empty', () => {
    const service = new WorkspaceService({
      readSnippets: () => [],
      readSnippetsFromEngine: () => [],
      writeSnippets: () => {}
    });

    const result = service.validate({ inputPath: 'test' });
    assert.strictEqual(result.hasErrors, false);
    assert.strictEqual(result.collisions.length, 0);
  });
});
