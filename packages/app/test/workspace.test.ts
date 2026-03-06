import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceService } from '../src/services/workspace';
import { Snippet } from '@snippet-engine-control/core';

test('WorkspaceService', async (t) => {
  await t.test('initializes and validates without errors on empty', () => {
    const service = new WorkspaceService({
      readSnippets: () => [],
      readSnippetsFromEngine: () => [],
      writeSnippets: () => { throw new Error('Not supposed to write during validate'); }
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
      readSnippetsFromEngine: () => { throw new Error('Should not be called'); },
      writeSnippets: () => { throw new Error('Not supposed to write during validate'); }
    });

    service.validate({});
    assert.strictEqual(wasCalled, true);
  });
});
