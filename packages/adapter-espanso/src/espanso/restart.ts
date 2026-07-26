import { LogOptions, RuntimeLogChunk } from '@snippet-engine-control/core';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCommand, SPAWN_TIMEOUT_MS } from '../utils/exec';

const ESPANSO_SERVICE = 'espanso.service';
const SNAP_CURRENT_BINARY = '/snap/espanso/current/espanso';
const SNAP_EXECUTABLE_PATTERN = /\/snap\/(?:bin\/espanso|espanso\/(?:current|\d+)\/espanso)\b/;
const SNAP_LAUNCHER_COMMAND_PATTERN = /\/snap\/(?:bin\/espanso|espanso\/(?:current|\d+)\/espanso)\s+launcher\b/;
const SNAP_DAEMON_COMMAND_PATTERN = /\/snap\/(?:bin\/espanso|espanso\/(?:current|\d+)\/espanso)\s+daemon\b/;
const DROP_IN_NAME = '10-sec-snap-wrapper.conf';
const STABILITY_WAIT_MS = 10_000;
export const ESPANSO_SNAP_DROP_IN = '[Service]\nExecStart=\nExecStart=/snap/espanso/current/espanso daemon\n';

type CommandRunner = typeof runCommand;

interface ServiceSnapshot {
  activeState: string;
  subState: string;
  mainPid: string;
  restartCount: string;
}

export interface RestartEspansoDependencies {
  run: CommandRunner;
  platform: NodeJS.Platform;
  homeDir: string;
  xdgConfigHome?: string;
  fileExists: (filePath: string) => boolean;
  writeDropIn: (filePath: string, content: string) => void;
  sleep: (milliseconds: number) => void;
}

function sleepSynchronously(milliseconds: number): void {
  const signal = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  Atomics.wait(signal, 0, 0, milliseconds);
}

function writeFileAtomically(filePath: string, content: string): void {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o755 });

  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );

  try {
    fs.writeFileSync(temporaryPath, content, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o644,
    });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function defaultRestartDependencies(): RestartEspansoDependencies {
  return {
    run: runCommand,
    platform: process.platform,
    homeDir: os.homedir(),
    xdgConfigHome: process.env.XDG_CONFIG_HOME,
    fileExists: fs.existsSync,
    writeDropIn: writeFileAtomically,
    sleep: sleepSynchronously,
  };
}

function configRoot(dependencies: RestartEspansoDependencies): string {
  if (dependencies.xdgConfigHome && path.isAbsolute(dependencies.xdgConfigHome)) {
    return dependencies.xdgConfigHome;
  }
  return path.join(dependencies.homeDir, '.config');
}

function readServiceSnapshot(dependencies: RestartEspansoDependencies): ServiceSnapshot | null {
  const result = dependencies.run(
    'systemctl',
    [
      '--user',
      'show',
      ESPANSO_SERVICE,
      '--property=ActiveState',
      '--property=SubState',
      '--property=MainPID',
      '--property=NRestarts',
    ],
    SPAWN_TIMEOUT_MS,
  );
  if (!result.ok) {
    return null;
  }

  const values = new Map<string, string>();
  for (const line of result.stdout.split('\n')) {
    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    values.set(line.slice(0, separator), line.slice(separator + 1));
  }

  return {
    activeState: values.get('ActiveState') ?? '',
    subState: values.get('SubState') ?? '',
    mainPid: values.get('MainPID') ?? '',
    restartCount: values.get('NRestarts') ?? '',
  };
}

function isHealthySnapshot(snapshot: ServiceSnapshot | null): snapshot is ServiceSnapshot {
  return snapshot !== null
    && snapshot.activeState === 'active'
    && snapshot.subState === 'running'
    && /^[1-9]\d*$/.test(snapshot.mainPid)
    && /^\d+$/.test(snapshot.restartCount);
}

function readSnapSystemdExecStart(dependencies: RestartEspansoDependencies): string | null {
  if (dependencies.platform !== 'linux' || !dependencies.fileExists(SNAP_CURRENT_BINARY)) {
    return null;
  }

  const fragment = dependencies.run(
    'systemctl',
    ['--user', 'show', ESPANSO_SERVICE, '--property=FragmentPath', '--value'],
    SPAWN_TIMEOUT_MS,
  );
  if (!fragment.ok || fragment.stdout.trim().length === 0) {
    return null;
  }

  const execStart = dependencies.run(
    'systemctl',
    ['--user', 'show', ESPANSO_SERVICE, '--property=ExecStart', '--value'],
    SPAWN_TIMEOUT_MS,
  );
  if (!execStart.ok || !SNAP_EXECUTABLE_PATTERN.test(execStart.stdout)) {
    return null;
  }

  return execStart.stdout;
}

function isSnapLauncherCommand(execStart: string): boolean {
  return SNAP_LAUNCHER_COMMAND_PATTERN.test(execStart);
}

function isSnapDaemonCommand(execStart: string): boolean {
  return SNAP_DAEMON_COMMAND_PATTERN.test(execStart);
}

function repairSnapSystemdService(
  dependencies: RestartEspansoDependencies,
  observedExecStart?: string | null,
): boolean {
  const execStart = observedExecStart ?? readSnapSystemdExecStart(dependencies);
  if (!execStart) {
    return false;
  }

  const usesLauncher = isSnapLauncherCommand(execStart);
  const usesDirectDaemon = isSnapDaemonCommand(execStart);
  if (!usesLauncher && !usesDirectDaemon) {
    return false;
  }

  if (usesLauncher) {
    const dropInPath = path.join(
      configRoot(dependencies),
      'systemd',
      'user',
      `${ESPANSO_SERVICE}.d`,
      DROP_IN_NAME,
    );

    try {
      dependencies.writeDropIn(dropInPath, ESPANSO_SNAP_DROP_IN);
    } catch {
      return false;
    }

    const reload = dependencies.run(
      'systemctl',
      ['--user', 'daemon-reload'],
      SPAWN_TIMEOUT_MS,
    );
    if (!reload.ok) {
      return false;
    }
  }

  const reset = dependencies.run(
    'systemctl',
    ['--user', 'reset-failed', ESPANSO_SERVICE],
    SPAWN_TIMEOUT_MS,
  );
  if (!reset.ok) {
    return false;
  }

  const restart = dependencies.run(
    'systemctl',
    ['--user', 'restart', ESPANSO_SERVICE],
    SPAWN_TIMEOUT_MS,
  );
  if (!restart.ok) {
    return false;
  }

  const before = readServiceSnapshot(dependencies);
  if (!isHealthySnapshot(before)) {
    return false;
  }

  dependencies.sleep(STABILITY_WAIT_MS);

  const after = readServiceSnapshot(dependencies);
  return isHealthySnapshot(after)
    && after.mainPid === before.mainPid
    && after.restartCount === before.restartCount;
}

export function restartEspansoWithDependencies(dependencies: RestartEspansoDependencies): boolean {
  try {
    const result = dependencies.run('espanso', ['restart'], SPAWN_TIMEOUT_MS);
    if (result.ok) {
      const execStart = readSnapSystemdExecStart(dependencies);
      if (!execStart || !isSnapLauncherCommand(execStart)) {
        return true;
      }
      return repairSnapSystemdService(dependencies, execStart);
    }
    return repairSnapSystemdService(dependencies);
  } catch {
    return false;
  }
}

export function restartEspanso(): boolean {
  return restartEspansoWithDependencies(defaultRestartDependencies());
}

export function logs(opts?: LogOptions): RuntimeLogChunk[] {
  const now = new Date().toISOString();
  try {
    const createErrorChunk = (message: string): RuntimeLogChunk[] => [{
      timestamp: now,
      level: 'error',
      message
    }];

    const args = ['log'];
    const result = runCommand('espanso', args, SPAWN_TIMEOUT_MS);

    if (result.error) {
      if (result.timedOut) {
        return createErrorChunk('Espanso log command timed out.');
      }
      return createErrorChunk('Espanso log command failed to execute.');
    }

    if (result.signal) {
      return createErrorChunk(`Espanso log command terminated by signal: ${result.signal}`);
    }

    if (result.exitCode === null) {
      return createErrorChunk('Espanso log command terminated abnormally.');
    }

    if (result.exitCode !== 0) {
      return createErrorChunk(`Espanso log command returned non-zero exit code: ${result.exitCode}`);
    }

    const lines = result.stdout.split('\n').filter(l => l.trim().length > 0);

    let tailLines = lines;
    if (opts && opts.tail !== undefined) {
      const tailCount = Math.trunc(opts.tail);
      if (tailCount <= 0) {
        return [];
      }
      tailLines = lines.slice(-tailCount);
    }

    return tailLines.map(line => ({
      timestamp: now, // Mocking timestamp as espanso log lines might not have parseable timestamps
      level: line.toLowerCase().includes('error') ? 'error' : line.toLowerCase().includes('warn') ? 'warn' : 'info',
      message: line
    }));
  } catch (e: any) {
    return [{
      timestamp: now,
      level: 'error',
      message: e.message || 'Unknown error while reading espanso logs.'
    }];
  }
}
