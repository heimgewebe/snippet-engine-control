import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationService } from '../src/services/validation';
import { Snippet } from '@snippet-engine-control/core';

test('ValidationService', async (t) => {
  await t.test('validates snippets successfully', () => {
    const service = new ValidationService();
    const mockSnippets: Snippet[] = [
      { id: '1', body: 'body', triggers: ['trigger'] }
    ];

    const result = service.validateSnippets(mockSnippets);
    assert.strictEqual(result.hasErrors, false);
    assert.strictEqual(result.collisions.length, 0);
  });

  await t.test('detects collisions directly', () => {
    const service = new ValidationService();
    const mockSnippets: Snippet[] = [
      { id: '1', body: 'body', triggers: ['trigger1'] },
      { id: '2', body: 'body', triggers: ['trigger1'] }
    ];

    const result = service.validateSnippets(mockSnippets);
    assert.strictEqual(result.hasErrors, true);
    assert.strictEqual(result.collisions.length, 1);
  });
});
