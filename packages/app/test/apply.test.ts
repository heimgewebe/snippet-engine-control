import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplyService } from '../src/services/apply';
import { ExportPlan } from '@snippet-engine-control/core';

test('ApplyService', async (t) => {
  await t.test('dry-run writes nothing and returns false', () => {
    let wasWritten = false;
    const applyService = new ApplyService({
      writePort: { writeSnippets: () => { wasWritten = true; } }
    });

    const plan: ExportPlan = { changes: [] };
    const result = applyService.applyPlan(plan, true);

    assert.strictEqual(result, false);
    assert.strictEqual(wasWritten, false);
  });

  await t.test('live run writes and returns true', () => {
    let wasWritten = false;
    const applyService = new ApplyService({
      writePort: { writeSnippets: () => { wasWritten = true; } }
    });

    const plan: ExportPlan = { changes: [] };
    const result = applyService.applyPlan(plan, false);

    assert.strictEqual(result, true);
    assert.strictEqual(wasWritten, true);
  });

  await t.test('rolls back on write failure', () => {
    let snapshotRestored = false;
    const applyService = new ApplyService({
      writePort: { writeSnippets: () => { throw new Error('Write Boom'); } },
      snapshotPort: {
        createSnapshot: () => 'snap1',
        restoreSnapshot: () => { snapshotRestored = true; },
        rollbackLatestSnapshot: () => false
      }
    });

    const plan: ExportPlan = { changes: [] };
    assert.throws(() => applyService.applyPlan(plan, false), /Write Boom/);
    assert.strictEqual(snapshotRestored, true);
  });

  await t.test('rolls back on verification failure', () => {
    let snapshotRestored = false;
    let written = false;
    const applyService = new ApplyService({
      writePort: { writeSnippets: () => { written = true; } },
      runtimePort: {
        verify: () => ({ ok: false, errors: ['Bad formatting'], warnings: [] }),
        health: () => ({ status: 'ok' })
      },
      snapshotPort: {
        createSnapshot: () => 'snap2',
        restoreSnapshot: () => { snapshotRestored = true; },
        rollbackLatestSnapshot: () => false
      }
    });

    const plan: ExportPlan = { changes: [] };
    assert.throws(() => applyService.applyPlan(plan, false), /Apply verification failed, rolled back to previous state/);
    assert.strictEqual(written, true);
    assert.strictEqual(snapshotRestored, true);
  });

  await t.test('throws explicitly on unsupported features regardless of dry-run state', () => {
    const applyService = new ApplyService({
      writePort: { writeSnippets: () => { throw new Error('Should not be called'); } }
    });

    const plan: ExportPlan = { changes: [], unsupportedFeatures: ['feature'] };
    assert.throws(() => applyService.applyPlan(plan, true), /Cannot apply plan with unsupported features/);
    assert.throws(() => applyService.applyPlan(plan, false), /Cannot apply plan with unsupported features/);
  });
});
