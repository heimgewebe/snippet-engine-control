import * as assert from 'node:assert/strict';
import test from 'node:test';
import { Snippet, PreviewResult, PreviewContext } from '@snippet-engine-control/core';
import { PreviewService } from '../src/services/preview';
import { EnginePreviewPort } from '../src/ports/engine';

test('PreviewService', async (t) => {
  await t.test('static snippet without template', () => {
    const service = new PreviewService();
    const snippet: Snippet = { id: 's1', triggers: ['!t'], body: 'Hello world' };
    const result = service.previewDocument(snippet);

    assert.equal(result.text, 'Hello world');
    assert.equal(result.isTemplate, false);
    assert.equal(result.warnings, undefined);
  });

  await t.test('snippet with {{...}} triggers isTemplate and warning', () => {
    const service = new PreviewService();
    const snippet: Snippet = { id: 's2', triggers: ['!t'], body: 'Hello {{name}}' };
    const result = service.previewDocument(snippet);

    assert.equal(result.text, 'Hello {{name}}');
    assert.equal(result.isTemplate, true);
    assert.equal(result.warnings?.length, 1);
    assert.match(result.warnings![0], /template variables/);
  });

  await t.test('enginePort succeeds', () => {
    const mockEnginePort: EnginePreviewPort = {
      preview(snippet: Snippet, ctx: PreviewContext): PreviewResult {
        return { text: 'Engine expansion', isTemplate: false };
      }
    };
    const service = new PreviewService(mockEnginePort);
    const snippet: Snippet = { id: 's3', triggers: ['!t'], body: 'Hello {{name}}' };
    const result = service.previewDocument(snippet);

    // EnginePort bypassed the fallback entirely.
    assert.equal(result.text, 'Engine expansion');
    assert.equal(result.isTemplate, false);
    assert.equal(result.warnings, undefined);
  });

  await t.test('enginePort throws -> fallback to simulateExpansion + engine warning', () => {
    const mockEnginePort: EnginePreviewPort = {
      preview(snippet: Snippet, ctx: PreviewContext): PreviewResult {
        throw new Error('Timeout');
      }
    };
    const service = new PreviewService(mockEnginePort);
    const snippet: Snippet = { id: 's4', triggers: ['!t'], body: 'Hello {{name}}' };
    const result = service.previewDocument(snippet);

    assert.equal(result.text, 'Hello {{name}}');
    assert.equal(result.isTemplate, true);
    assert.equal(result.warnings?.length, 2);
    assert.match(result.warnings![0], /template variables/);
    assert.match(result.warnings![1], /Engine preview failed: Timeout/);
  });
});
