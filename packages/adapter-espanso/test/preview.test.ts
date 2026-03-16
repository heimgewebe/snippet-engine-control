import test from 'node:test';
import * as assert from 'node:assert/strict';
import { preview } from '../src/espanso/preview';
import { Snippet } from '@snippet-engine-control/core';

test('preview() with empty snippet.body', () => {
  const snippet: Snippet = { id: 'test1', triggers: ['trig'], body: '' };
  const res = preview(snippet, {});
  assert.equal(res.text, '');
  assert.deepEqual(res.trace, ['No body to expand.']);
});

test('Clipboard expansion with explicit value', () => {
  const snippet: Snippet = { id: 'test2', triggers: ['trig'], body: 'Hello {{clipboard}}' };
  const res = preview(snippet, { clipboardText: 'World' });
  assert.equal(res.text, 'Hello World');
  assert.equal(res.isTemplate, false);
  assert.ok(res.trace?.includes('Expanded {{clipboard}} to "World"'));
});

test('Clipboard expansion without value', () => {
  const snippet: Snippet = { id: 'test3', triggers: ['trig'], body: 'Hello {{clipboard}}' };
  const res = preview(snippet, {});
  assert.equal(res.text, 'Hello [Mock Clipboard Content]');
  assert.ok(res.trace?.includes('Expanded {{clipboard}} to "[Mock Clipboard Content]"'));
});

test('Clipboard expansion with empty string', () => {
  const snippet: Snippet = { id: 'test4', triggers: ['trig'], body: 'Hello {{clipboard}}!' };
  const res = preview(snippet, { clipboardText: '' });
  assert.equal(res.text, 'Hello !');
  assert.ok(res.trace?.includes('Expanded {{clipboard}} to ""'));
});

test('Multiple date variables', () => {
  const snippet: Snippet = { id: 'test5', triggers: ['trig'], body: '{{mydate}} and {{otherdate}}' };
  const res = preview(snippet, { currentDate: '2025-01-01' });
  assert.equal(res.text, '2025-01-01 and 2025-01-01');
  assert.ok(res.trace?.includes('Expanded date variable {{mydate}} to "2025-01-01"'));
  assert.ok(res.trace?.includes('Expanded date variable {{otherdate}} to "2025-01-01"'));
});

test('Unresolved variables warning', () => {
  const snippet: Snippet = { id: 'test6', triggers: ['trig'], body: '{{clipboard}} and {{unknown}}' };
  const res = preview(snippet, { clipboardText: 'Content' });
  assert.equal(res.text, 'Content and {{unknown}}');
  assert.equal(res.isTemplate, true);
  assert.ok(res.trace?.includes('Warning: Unresolved template variables remain.'));
});
