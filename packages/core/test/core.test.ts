import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

import { analyzeConflicts } from '../src/analyzers/conflicts';
import { normalize } from '../src/ir/normalize';
import { fingerprint } from '../src/ir/fingerprint';
import { Snippet } from '../src/model/snippet';

const loadFixture = (filename: string): Snippet[] => {
  // Using relative path to run tests from package root correctly
  const p = path.join(__dirname, '../../../../fixtures', filename);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

test('Core Analyzer - sample fixture has no triggerCollisions', () => {
  const snippets = loadFixture('snippets.sample.json');
  const diagnostics = analyzeConflicts(snippets);
  assert.equal(diagnostics.triggerCollisions.length, 0);
});

test('Core Analyzer - conflict fixture has triggerCollisions', () => {
  const snippets = loadFixture('snippets.conflict.json');
  const diagnostics = analyzeConflicts(snippets);
  assert.ok(diagnostics.triggerCollisions.length > 0);
});

test('Core IR - normalize is deterministic', () => {
  const snippet1: Snippet = {
    id: 'test',
    triggers: ['b', 'a'],
    body: 'hello\r\nworld',
    tags: ['z', 'y']
  };

  const normalized = normalize(snippet1);
  assert.deepEqual(normalized.triggers, ['a', 'b']);
  assert.equal(normalized.body, 'hello\nworld');
  assert.deepEqual(normalized.tags, ['y', 'z']);
});

test('Core IR - fingerprint is deterministic', () => {
  const snippet1: Snippet = {
    id: 'test',
    triggers: ['b', 'a'],
    body: 'hello\r\nworld',
  };

  const snippet2: Snippet = {
    id: 'test2', // ID doesn't matter for fingerprint
    triggers: ['a', 'b'],
    body: 'hello\nworld',
    origin: {
      source: 'file',
      path: '/some/path'
    }
  };

  const hash1 = fingerprint(snippet1);
  const hash2 = fingerprint(snippet2);

  assert.equal(hash1, hash2);
});

test('Core IR - fingerprint stable stringify handles object key order', () => {
  const snippet1: Snippet = {
    id: 'test',
    triggers: ['a'],
    body: 'hello',
    constraints: {
      wordBoundary: true,
      appExclude: ['a'],
    }
  };

  const snippet2: Snippet = {
    id: 'test',
    triggers: ['a'],
    body: 'hello',
    constraints: {
      appExclude: ['a'],
      wordBoundary: true,
    }
  };

  const hash1 = fingerprint(snippet1);
  const hash2 = fingerprint(snippet2);

  assert.equal(hash1, hash2);
});
