import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test('sec lint forwards engine and dir to validate (collision detected from espanso dir)', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-lint-test-'));

  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const matchDir = path.join(tempDir, 'match');
  fs.mkdirSync(matchDir);

  // Two snippets with the same trigger — ValidationService must detect a collision.
  // This collision is only reachable if engine=espanso and dir are forwarded:
  // without them, loadSnippets() returns [] (no inputPath given, no SEC_SNIPPETS),
  // so validation would pass silently and exit 0.
  const yaml = `
matches:
  - trigger: ":dup"
    replace: "first"
  - trigger: ":dup"
    replace: "second"
`;
  fs.writeFileSync(path.join(matchDir, 'base.yml'), yaml, 'utf8');

  const cliPath = path.resolve(__dirname, '../src/index.js');

  let failed = false;
  try {
    execFileSync('node', [cliPath, 'lint', '--engine', 'espanso', '--dir', tempDir], { stdio: 'pipe' });
  } catch (error: any) {
    failed = true;
    assert.equal(error.status, 1);
    const stderr = error.stderr.toString();
    assert.match(stderr, /Validation failed/);
    assert.match(stderr, /collision/i);
  }

  assert.equal(failed, true, 'sec lint should exit 1 when espanso dir contains a trigger collision');
});
