import test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { buildExportPlan } from '../src/plan';
import { Snippet } from '@snippet-engine-control/core';

test('buildExportPlan integration tests', async (t) => {
  await t.test('engine !== espanso returns empty plan', () => {
    const result = buildExportPlan({ engine: 'unknown' }, []);
    assert.deepEqual(result, { changes: [], unsupportedFeatures: [] });
  });

  await t.test('passes sourceSnippets without needing inputPath and no file exists', (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-cli-plan-test-'));
    t.after(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const snippets: Snippet[] = [
      { id: '1', triggers: [':test1'], body: 'body1' }
    ];

    const result = buildExportPlan({ engine: 'espanso', dir: tempDir }, snippets);
    assert.equal(result.changes.length, 1);

    const change = result.changes[0];
    assert.equal(change.action, 'create');
    assert.match(change.content!, /:test1/);
    assert.match(change.content!, /body1/);
  });

  await t.test('throws non-ENOENT read errors', (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-cli-plan-test-'));
    t.after(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const matchDir = path.join(tempDir, 'match');
    fs.mkdirSync(matchDir);
    const targetFile = path.join(matchDir, 'sec.generated.yml');

    // Create a directory where the file should be to force an EISDIR error
    fs.mkdirSync(targetFile);

    const snippets: Snippet[] = [
      { id: '3', triggers: [':err'], body: 'err' }
    ];

    assert.throws(() => {
      buildExportPlan({ engine: 'espanso', dir: tempDir }, snippets);
    }, (err: NodeJS.ErrnoException) => {
      return err.code === 'EISDIR';
    });
  });

  await t.test('detects existing file and passes existingContent', (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-cli-plan-test-'));
    t.after(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const matchDir = path.join(tempDir, 'match');
    fs.mkdirSync(matchDir);
    const targetFile = path.join(matchDir, 'sec.generated.yml');

    const existingContent = 'matches:\n  - trigger: :old\n    replace: old\n';
    fs.writeFileSync(targetFile, existingContent, 'utf8');

    const snippets: Snippet[] = [
      { id: '2', triggers: [':new'], body: 'new' }
    ];

    const result = buildExportPlan({ engine: 'espanso', dir: tempDir }, snippets);
    assert.equal(result.changes.length, 1);

    const change = result.changes[0];
    assert.equal(change.action, 'update'); // plan service changes to update when hashes differ
    assert.ok(change.beforeHash, 'existingContent was not used'); // ensures existingContent was used
    assert.match(change.content!, /:new/);
    assert.match(change.content!, /new/);
    assert.doesNotMatch(change.content!, /:old/);
  });
});
