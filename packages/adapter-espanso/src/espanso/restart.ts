import { LogOptions, RuntimeLogChunk } from '@snippet-engine-control/core';
import { runCommand, SPAWN_TIMEOUT_MS } from '../utils/exec';

export function restartEspanso(): boolean {
  try {
    const result = runCommand('espanso', ['restart'], SPAWN_TIMEOUT_MS);
    return result.ok;
  } catch (e) {
    return false;
  }
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
