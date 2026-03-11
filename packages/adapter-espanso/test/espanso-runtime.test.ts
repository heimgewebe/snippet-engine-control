import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { ExportPlan } from '@snippet-engine-control/core';
import { health, verify } from '../src/espanso/runtime';

test('Espanso Runtime - health()', async (t) => {
  await t.test('returns error when config dir does not exist', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-health-test-1-'));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    const nonExistentDir = path.join(tmpDir, 'does-not-exist');
    const result = health(nonExistentDir);
    assert.strictEqual(result.status, 'error');
    assert.match(result.message!, /Config directory does not exist/);
  });

  await t.test('returns degraded when match dir is missing', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-health-test-2-'));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    const result = health(tmpDir);
    assert.strictEqual(result.status, 'degraded');
    assert.match(result.message!, /match\/ directory is missing/);
  });

  await t.test('returns ok when match dir is present and readable', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-health-test-3-'));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    fs.mkdirSync(path.join(tmpDir, 'match'));

    const result = health(tmpDir);
    assert.strictEqual(result.status, 'ok');
    assert.match(result.message!, /Espanso configuration directory found and readable/);
  });
});

test('Espanso Runtime - verify()', async (t) => {
  await t.test('fails when created file is missing', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-verify-test-1-'));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    const plan: ExportPlan = {
      changes: [{ action: 'create', file: path.join(tmpDir, 'missing.yml') }]
    };

    const result = verify(plan);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0], /File missing after apply/);
  });

  await t.test('fails on invalid YAML', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-verify-test-2-'));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    const invalidYamlFile = path.join(tmpDir, 'invalid.yml');
    fs.writeFileSync(invalidYamlFile, 'matches:\n  - trigger: test\n   replace: test', 'utf8'); // Bad indentation

    const plan: ExportPlan = {
      changes: [{ action: 'update', file: invalidYamlFile }]
    };

    const result = verify(plan);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0], /Invalid YAML in file/);
  });

  await t.test('fails on content hash mismatch', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-verify-test-3-'));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    const validYamlFile = path.join(tmpDir, 'valid.yml');
    const content = 'matches:\n  - trigger: test\n    replace: test\n';
    fs.writeFileSync(validYamlFile, content, 'utf8');

    const wrongHash = crypto.createHash('sha256').update('wrong content').digest('hex');

    const plan: ExportPlan = {
      changes: [{ action: 'update', file: validYamlFile, afterHash: wrongHash }]
    };

    const result = verify(plan);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0], /Content hash mismatch/);
  });

  await t.test('succeeds on correct content hash', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-verify-test-4-'));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    const validYamlFile = path.join(tmpDir, 'valid.yml');
    const content = 'matches:\n  - trigger: test\n    replace: test\n';
    fs.writeFileSync(validYamlFile, content, 'utf8');

    const correctHash = crypto.createHash('sha256').update(content).digest('hex');

    const plan: ExportPlan = {
      changes: [{ action: 'update', file: validYamlFile, afterHash: correctHash }]
    };

    const result = verify(plan);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.errors.length, 0);
  });

  await t.test('fails if deleted file still exists', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-verify-test-5-'));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    const deletedFile = path.join(tmpDir, 'deleted.yml');
    fs.writeFileSync(deletedFile, 'matches:\n', 'utf8');

    const plan: ExportPlan = {
      changes: [{ action: 'delete', file: deletedFile }]
    };

    const result = verify(plan);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0], /File was not deleted/);
  });

  await t.test('succeeds if deleted file is gone', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-verify-test-6-'));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    const deletedFile = path.join(tmpDir, 'deleted.yml');

    const plan: ExportPlan = {
      changes: [{ action: 'delete', file: deletedFile }]
    };

    const result = verify(plan);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.errors.length, 0);
  });
});
