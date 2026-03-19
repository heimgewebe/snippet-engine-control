import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'child_process';
import { runCommand, SPAWN_TIMEOUT_MS } from '../src/utils/exec';

test('runCommand', async (t) => {
  await t.test('success (zero exit, no error)', (t) => {
    t.mock.method(cp, 'spawnSync', () => {
      return {
        stdout: 'ok\n',
        stderr: '',
        status: 0,
        signal: null,
        error: undefined
      };
    });

    const result = runCommand('test-cmd', ['arg1'], SPAWN_TIMEOUT_MS);

    assert.equal(result.ok, true);
    assert.equal(result.stdout, 'ok\n');
    assert.equal(result.stderr, '');
    assert.equal(result.exitCode, 0);
    assert.equal(result.timedOut, false);
    assert.equal(result.signal, null);
    assert.equal(result.error, undefined);
  });

  await t.test('non-zero exit code', (t) => {
    t.mock.method(cp, 'spawnSync', () => {
      return {
        stdout: 'output',
        stderr: 'some error output',
        status: 2,
        signal: null,
        error: undefined
      };
    });

    const result = runCommand('test-cmd', [], SPAWN_TIMEOUT_MS);

    assert.equal(result.ok, false);
    assert.equal(result.exitCode, 2);
    assert.equal(result.timedOut, false);
    assert.equal(result.signal, null);
    assert.equal(result.error, undefined);
  });

  await t.test('timeout (ETIMEDOUT)', (t) => {
    t.mock.method(cp, 'spawnSync', () => {
      return {
        stdout: '',
        stderr: '',
        status: null,
        signal: null,
        error: Object.assign(new Error('spawnSync ETIMEDOUT'), { code: 'ETIMEDOUT' })
      };
    });

    const result = runCommand('test-cmd', [], SPAWN_TIMEOUT_MS);

    assert.equal(result.ok, false);
    assert.equal(result.timedOut, true);
    assert.equal(result.error, 'spawnSync ETIMEDOUT');
  });

  await t.test('signal termination', (t) => {
    t.mock.method(cp, 'spawnSync', () => {
      return {
        stdout: '',
        stderr: '',
        status: null,
        signal: 'SIGTERM',
        error: undefined
      };
    });

    const result = runCommand('test-cmd', [], SPAWN_TIMEOUT_MS);

    assert.equal(result.ok, false);
    assert.equal(result.signal, 'SIGTERM');
    assert.equal(result.exitCode, null);
    assert.equal(result.timedOut, false);
  });

  await t.test('stdout/stderr fallback to empty strings', (t) => {
    t.mock.method(cp, 'spawnSync', () => {
      return {
        stdout: undefined, // Simulating missing stdout
        stderr: null,      // Simulating falsy stderr
        status: 0,
        signal: null,
        error: undefined
      };
    });

    const result = runCommand('test-cmd', [], SPAWN_TIMEOUT_MS);

    assert.equal(result.ok, true);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
    assert.equal(result.exitCode, 0);
  });

  await t.test('unexpected thrown error', (t) => {
    t.mock.method(cp, 'spawnSync', () => {
      throw new Error('Unexpected catastrophic error');
    });

    const result = runCommand('test-cmd', [], SPAWN_TIMEOUT_MS);

    assert.equal(result.ok, false);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
    assert.equal(result.error, 'Unexpected catastrophic error');
  });
});
