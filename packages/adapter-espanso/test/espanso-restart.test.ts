import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import {
  ESPANSO_SNAP_DROP_IN,
  RestartEspansoDependencies,
  restartEspansoWithDependencies,
} from '../src/espanso/restart';
import { ExecResult } from '../src/utils/exec';

const SERVICE_SNAPSHOT_COMMAND = 'systemctl --user show espanso.service --property=ActiveState --property=SubState --property=MainPID --property=NRestarts';

function result(ok: boolean, stdout = '', stderr = ''): ExecResult {
  return { ok, stdout, stderr, exitCode: ok ? 0 : 1 };
}

function snapshot(mainPid: string, restartCount: string, activeState = 'active', subState = 'running'): ExecResult {
  return result(true, [
    `ActiveState=${activeState}`,
    `SubState=${subState}`,
    `MainPID=${mainPid}`,
    `NRestarts=${restartCount}`,
    '',
  ].join('\n'));
}

function dependencies(overrides: Partial<RestartEspansoDependencies> = {}): RestartEspansoDependencies {
  return {
    run: () => result(false),
    platform: 'linux',
    homeDir: '/home/tester',
    xdgConfigHome: '/tmp/sec-config',
    fileExists: filePath => filePath === '/snap/espanso/current/espanso',
    writeDropIn: () => undefined,
    sleep: () => undefined,
    ...overrides,
  };
}

test('restartEspansoWithDependencies returns after a successful native restart', () => {
  const calls: string[] = [];
  let wroteDropIn = false;
  let slept = false;
  const restarted = restartEspansoWithDependencies(dependencies({
    run: (command, args) => {
      calls.push([command, ...args].join(' '));
      return result(true);
    },
    writeDropIn: () => {
      wroteDropIn = true;
    },
    sleep: () => {
      slept = true;
    },
  }));

  assert.equal(restarted, true);
  assert.deepEqual(calls, ['espanso restart']);
  assert.equal(wroteDropIn, false);
  assert.equal(slept, false);
});

test('repairs a revision-bound Snap user service and verifies delayed stability', () => {
  const calls: string[] = [];
  const writes: Array<{ filePath: string; content: string }> = [];
  const waits: number[] = [];
  let snapshotReads = 0;
  const restarted = restartEspansoWithDependencies(dependencies({
    run: (command, args) => {
      const call = [command, ...args].join(' ');
      calls.push(call);
      if (call === 'espanso restart') return result(false, '', 'restart failed');
      if (call.includes('--property=FragmentPath')) {
        return result(true, '/home/tester/.config/systemd/user/espanso.service\n');
      }
      if (call.includes('--property=ExecStart')) {
        return result(true, '{ path=/snap/espanso/323/espanso ; argv[]=/snap/espanso/323/espanso launcher ; }\n');
      }
      if (call === 'systemctl --user daemon-reload') return result(true);
      if (call === 'systemctl --user reset-failed espanso.service') return result(true);
      if (call === 'systemctl --user restart espanso.service') return result(true);
      if (call === SERVICE_SNAPSHOT_COMMAND) {
        snapshotReads += 1;
        return snapshot('1234', '0');
      }
      return result(false, '', `unexpected command: ${call}`);
    },
    writeDropIn: (filePath, content) => writes.push({ filePath, content }),
    sleep: milliseconds => waits.push(milliseconds),
  }));

  assert.equal(restarted, true);
  assert.equal(snapshotReads, 2);
  assert.deepEqual(waits, [10_000]);
  assert.deepEqual(writes, [{
    filePath: path.join('/tmp/sec-config', 'systemd/user/espanso.service.d/10-sec-snap-wrapper.conf'),
    content: ESPANSO_SNAP_DROP_IN,
  }]);
  assert.deepEqual(calls, [
    'espanso restart',
    'systemctl --user show espanso.service --property=FragmentPath --value',
    'systemctl --user show espanso.service --property=ExecStart --value',
    'systemctl --user daemon-reload',
    'systemctl --user reset-failed espanso.service',
    'systemctl --user restart espanso.service',
    SERVICE_SNAPSHOT_COMMAND,
    SERVICE_SNAPSHOT_COMMAND,
  ]);
});

test('rewrites the unstable Snap wrapper override to the current binary', () => {
  const writes: Array<{ filePath: string; content: string }> = [];
  const restarted = restartEspansoWithDependencies(dependencies({
    run: (command, args) => {
      const call = [command, ...args].join(' ');
      if (call === 'espanso restart') return result(false);
      if (call.includes('--property=FragmentPath')) return result(true, '/home/tester/.config/systemd/user/espanso.service\n');
      if (call.includes('--property=ExecStart')) {
        return result(true, '{ path=/snap/bin/espanso ; argv[]=/snap/bin/espanso launcher ; }\n');
      }
      if (call === 'systemctl --user daemon-reload') return result(true);
      if (call === 'systemctl --user reset-failed espanso.service') return result(true);
      if (call === 'systemctl --user restart espanso.service') return result(true);
      if (call === SERVICE_SNAPSHOT_COMMAND) return snapshot('1234', '0');
      return result(false);
    },
    writeDropIn: (filePath, content) => writes.push({ filePath, content }),
  }));

  assert.equal(restarted, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].content, ESPANSO_SNAP_DROP_IN);
  assert.match(writes[0].content, /\/snap\/espanso\/current\/espanso launcher/);
});

test('keeps the current Snap binary override idempotent', () => {
  let writes = 0;
  const restarted = restartEspansoWithDependencies(dependencies({
    run: (command, args) => {
      const call = [command, ...args].join(' ');
      if (call === 'espanso restart') return result(false);
      if (call.includes('--property=FragmentPath')) return result(true, '/usr/lib/systemd/user/espanso.service\n');
      if (call.includes('--property=ExecStart')) {
        return result(true, '{ path=/snap/espanso/current/espanso ; argv[]=/snap/espanso/current/espanso launcher ; }\n');
      }
      if (call === 'systemctl --user daemon-reload') return result(true);
      if (call === 'systemctl --user reset-failed espanso.service') return result(true);
      if (call === 'systemctl --user restart espanso.service') return result(true);
      if (call === SERVICE_SNAPSHOT_COMMAND) return snapshot('1234', '0');
      return result(false);
    },
    writeDropIn: () => {
      writes += 1;
    },
  }));

  assert.equal(restarted, true);
  assert.equal(writes, 1);
});

test('does not modify non-Snap services after a native restart failure', () => {
  let wroteDropIn = false;
  const restarted = restartEspansoWithDependencies(dependencies({
    run: (command, args) => {
      const call = [command, ...args].join(' ');
      if (call === 'espanso restart') return result(false);
      if (call.includes('--property=FragmentPath')) return result(true, '/home/tester/.config/systemd/user/espanso.service\n');
      if (call.includes('--property=ExecStart')) {
        return result(true, '{ path=/usr/local/bin/espanso ; argv[]=/usr/local/bin/espanso launcher ; }\n');
      }
      return result(false);
    },
    writeDropIn: () => {
      wroteDropIn = true;
    },
  }));

  assert.equal(restarted, false);
  assert.equal(wroteDropIn, false);
});

test('reports failure when the repaired service restarts during the stability window', () => {
  let snapshotReads = 0;
  const restarted = restartEspansoWithDependencies(dependencies({
    run: (command, args) => {
      const call = [command, ...args].join(' ');
      if (call === 'espanso restart') return result(false);
      if (call.includes('--property=FragmentPath')) return result(true, '/home/tester/.config/systemd/user/espanso.service\n');
      if (call.includes('--property=ExecStart')) {
        return result(true, '{ path=/snap/espanso/323/espanso ; argv[]=/snap/espanso/323/espanso launcher ; }\n');
      }
      if (call === 'systemctl --user daemon-reload') return result(true);
      if (call === 'systemctl --user reset-failed espanso.service') return result(true);
      if (call === 'systemctl --user restart espanso.service') return result(true);
      if (call === SERVICE_SNAPSHOT_COMMAND) {
        snapshotReads += 1;
        return snapshot(snapshotReads === 1 ? '1234' : '5678', snapshotReads === 1 ? '0' : '1');
      }
      return result(false);
    },
  }));

  assert.equal(restarted, false);
  assert.equal(snapshotReads, 2);
});

test('reports failure when the repaired service is not active before the wait', () => {
  let slept = false;
  const restarted = restartEspansoWithDependencies(dependencies({
    run: (command, args) => {
      const call = [command, ...args].join(' ');
      if (call === 'espanso restart') return result(false);
      if (call.includes('--property=FragmentPath')) return result(true, '/home/tester/.config/systemd/user/espanso.service\n');
      if (call.includes('--property=ExecStart')) {
        return result(true, '{ path=/snap/espanso/323/espanso ; argv[]=/snap/espanso/323/espanso launcher ; }\n');
      }
      if (call === 'systemctl --user daemon-reload') return result(true);
      if (call === 'systemctl --user reset-failed espanso.service') return result(true);
      if (call === 'systemctl --user restart espanso.service') return result(true);
      if (call === SERVICE_SNAPSHOT_COMMAND) return snapshot('0', '0', 'failed', 'failed');
      return result(false);
    },
    sleep: () => {
      slept = true;
    },
  }));

  assert.equal(restarted, false);
  assert.equal(slept, false);
});

test('does not attempt systemd repair outside Linux', () => {
  const calls: string[] = [];
  const restarted = restartEspansoWithDependencies(dependencies({
    platform: 'darwin',
    run: (command, args) => {
      calls.push([command, ...args].join(' '));
      return result(false);
    },
  }));

  assert.equal(restarted, false);
  assert.deepEqual(calls, ['espanso restart']);
});
