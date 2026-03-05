import * as assert from 'assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { writeSnippets } from '../src/espanso/write';

/**
 * Verifies that the given path has restrictive permissions:
 * - No permissions for "group" or "others" ((mode & 0o077) === 0)
 * - Optional: owner has at least read/write for files or read/write/execute for dirs.
 */
function assertRestrictivePermissions(targetPath: string, isDirectory: boolean) {
  const stat = fs.statSync(targetPath);
  const mode = stat.mode & 0o777;

  // Crucial check: group and others must have ZERO permissions
  assert.equal(mode & 0o077, 0, `Path ${targetPath} should have no group/other permissions, but got mode ${mode.toString(8)}`);

  if (isDirectory) {
    // Owner should have rwx (0o700)
    assert.equal(mode & 0o700, 0o700, `Directory ${targetPath} should have owner rwx permissions`);
  } else {
    // Owner should have rw (0o600)
    assert.equal(mode & 0o600, 0o600, `File ${targetPath} should have owner rw permissions`);
  }
}

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

  assertRestrictivePermissions(targetDir, true);
  assertRestrictivePermissions(targetFile, false);
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

  // Note: mkdirSync with recursive: true and chmodSync on the final dirPath
  // currently only guarantees the final dirPath has 0o700.
  // intermediate dirs (d1) might follow umask.
  // In our implementation, dirPath is path.dirname(change.file), which is d2.
  assertRestrictivePermissions(nestedDir, true);
});

test('Espanso Write Security - update sets restrictive permissions', (t) => {
  if (process.platform === 'win32') {
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-security-update-test-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const targetFile = path.join(tmpDir, 'update-test.yml');
  // Create with loose permissions
  fs.writeFileSync(targetFile, 'initial', { mode: 0o666 });

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

  assertRestrictivePermissions(targetFile, false);
});

test('Espanso Write Security - stale permissive tmp file is removed', (t) => {
  if (process.platform === 'win32') {
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-stale-tmp-test-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const targetFile = path.join(tmpDir, 'stale-tmp.yml');
  const staleTmpFile = targetFile + '.tmp';

  // Pre-create a stale tmp file with permissive permissions (0o666)
  fs.writeFileSync(staleTmpFile, 'stale content', { mode: 0o666 });
  const initialStat = fs.statSync(staleTmpFile);
  // Verify it is indeed permissive (or at least not strictly 0o600 if umask allows)
  // We just want to ensure our code fixes it.

  const plan: any = {
    changes: [
      {
        action: 'create',
        file: targetFile,
        content: 'fresh content'
      }
    ]
  };

  writeSnippets(plan);

  // Final file should have restrictive permissions, even if the tmp it used was stale/permissive
  assertRestrictivePermissions(targetFile, false);
  assert.equal(fs.readFileSync(targetFile, 'utf8'), 'fresh content');
  assert.equal(fs.existsSync(staleTmpFile), false, 'Stale tmp file should have been removed/renamed');
});
