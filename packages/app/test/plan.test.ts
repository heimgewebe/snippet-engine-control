import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlanService } from '../src/services/plan';
import { Snippet } from '@snippet-engine-control/core';

test('PlanService', async (t) => {
  await t.test('buildPlan with empty snippets and no existing content', () => {
    const service = new PlanService();
    const result = service.buildPlan([], {
      engine: 'espanso',
      targetFile: '/test/match.yml',
      fileExists: false
    });

    assert.equal(result.changes.length, 1);
    const change = result.changes[0];

    assert.equal(change.action, 'create');
    assert.equal(change.beforeHash, undefined);
    assert.ok(change.afterHash);
    assert.equal(change.file, '/test/match.yml');
    assert.match(change.content!, /matches: \[\]/);
  });

  await t.test('buildPlan with unsupported features records them in plan', () => {
    const service = new PlanService();
    const snippets: Snippet[] = [
      {
        id: '1',
        triggers: ['t1'],
        body: 'b1',
        constraints: { localeHints: ['en'] },
        tags: ['tag1']
      }
    ];

    const result = service.buildPlan(snippets, {
      engine: 'espanso',
      targetFile: '/test/match.yml',
      fileExists: false
    });

    assert.ok(result.unsupportedFeatures);
    assert.equal(result.unsupportedFeatures!.length, 2);
    assert.match(result.unsupportedFeatures![0], /localeHints/);
    assert.match(result.unsupportedFeatures![1], /tags/);
  });

  await t.test('buildPlan with existing content computes hashes and sets action to update', () => {
    const service = new PlanService();
    const snippets: Snippet[] = [
      {
        id: '2',
        triggers: ['t2'],
        body: 'b2',
        constraints: { wordBoundary: true }
      }
    ];

    const existingContent = 'matches:\n  - trigger: t1\n    replace: b1\n';

    const result = service.buildPlan(snippets, {
      engine: 'espanso',
      targetFile: '/test/match.yml',
      fileExists: true,
      existingContent
    });

    assert.equal(result.changes.length, 1);
    const change = result.changes[0];

    assert.equal(change.action, 'update');
    assert.ok(change.beforeHash);
    assert.ok(change.afterHash);
    assert.notEqual(change.beforeHash, change.afterHash);
    assert.match(change.content!, /trigger: t2/);
    assert.match(change.content!, /word: true/);
  });

  await t.test('buildPlan for non-espanso engine returns empty plan', () => {
    const service = new PlanService();
    const result = service.buildPlan([], {
      engine: 'unknown',
      targetFile: '/test/match.yml',
      fileExists: false
    });

    assert.equal(result.changes.length, 0);
  });
});