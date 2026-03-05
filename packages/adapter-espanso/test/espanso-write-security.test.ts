import * as assert from 'assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { writeSnippets } from '../src/espanso/write';

test('Espanso Write Security - restrictive permissions', (t) => {
  if (process.platform === 'win32') {
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-security-test-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const targetDir = path.join(tmpDir, 'new-dir');
  const targetFile = path.join(targetDir, 'test.yml');

  const plan: any = {
    changes: [
      {
        action: 'create',
        file: targetFile,
        content: 'hello: world'
      }
    ]
  };

  writeSnippets(plan);

  const dirStat = fs.statSync(targetDir);
  assert.equal(dirStat.mode & 0o777, 0o700, 'Directory should have 0o700 permissions');

  const fileStat = fs.statSync(targetFile);
  assert.equal(fileStat.mode & 0o777, 0o600, 'File should have 0o600 permissions');
});

test('Espanso Write Security - nested directories', (t) => {
  if (process.platform === 'win32') {
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-nested-test-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const nestedDir = path.join(tmpDir, 'd1', 'd2');
  const nestedFile = path.join(nestedDir, 'test.yml');

  const plan: any = {
    changes: [
      {
        action: 'create',
        file: nestedFile,
        content: 'hello: world'
      }
    ]
  };

  writeSnippets(plan);

  assert.equal(fs.statSync(path.join(tmpDir, 'd1')).mode & 0o777, 0o700, 'd1 should have 0o700');
  assert.equal(fs.statSync(nestedDir).mode & 0o777, 0o700, 'd2 should have 0o700');
});

test('Espanso Write Security - update sets restrictive permissions', (t) => {
  if (process.platform === 'win32') {
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-security-update-test-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const targetFile = path.join(tmpDir, 'update-test.yml');
  fs.writeFileSync(targetFile, 'initial', { mode: 0o644 });

  const plan: any = {
    changes: [
      {
        action: 'update',
        file: targetFile,
        content: 'updated'
      }
    ]
  };

  writeSnippets(plan);

  const fileStat = fs.statSync(targetFile);
  assert.equal(fileStat.mode & 0o777, 0o600, 'Updated file should have 0o600 permissions');
});
