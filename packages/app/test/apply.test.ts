import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplyService } from '../src/services/apply';
import { ExportPlan } from '@snippet-engine-control/core';

test('ApplyService', async (t) => {
  await t.test('dry-run writes nothing and returns false', () => {
    let wasWritten = false;
    const applyService = new ApplyService({
      writeSnippets: () => { wasWritten = true; }
    });

    const plan: ExportPlan = { changes: [] };
    const result = applyService.applyPlan(plan, true);

    assert.strictEqual(result, false);
    assert.strictEqual(wasWritten, false);
  });

  await t.test('live run writes and returns true', () => {
    let wasWritten = false;
    const applyService = new ApplyService({
      writeSnippets: () => { wasWritten = true; }
    });

    const plan: ExportPlan = { changes: [] };
    const result = applyService.applyPlan(plan, false);

    assert.strictEqual(result, true);
    assert.strictEqual(wasWritten, true);
  });

  await t.test('throws explicitly on unsupported features regardless of dry-run state', () => {
    const applyService = new ApplyService({
      writeSnippets: () => { throw new Error('Should not be called'); }
    });

    const plan: ExportPlan = { changes: [], unsupportedFeatures: ['feature'] };
    assert.throws(() => applyService.applyPlan(plan, true), /Cannot apply plan with unsupported features/);
    assert.throws(() => applyService.applyPlan(plan, false), /Cannot apply plan with unsupported features/);
  });
});
