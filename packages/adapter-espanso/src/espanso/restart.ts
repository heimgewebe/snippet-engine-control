import { spawnSync } from 'child_process';
import { LogOptions, RuntimeLogChunk } from '@snippet-engine-control/core';

const SPAWN_TIMEOUT_MS = 5000;

export function restartEspanso(): boolean {
  try {
    const result = spawnSync('espanso', ['restart'], { encoding: 'utf8', timeout: SPAWN_TIMEOUT_MS });
    if (result.error || result.signal || result.status === null) {
      return false;
    }
    return result.status === 0;
  } catch (e) {
    return false;
  }
}

export function logs(opts?: LogOptions): RuntimeLogChunk[] {
  try {
    const createErrorChunk = (message: string): RuntimeLogChunk[] => [{
      timestamp: new Date().toISOString(),
      level: 'error',
      message
    }];

    const args = ['log'];
    const result = spawnSync('espanso', args, { encoding: 'utf8', timeout: SPAWN_TIMEOUT_MS });

    if (result.error) {
      if ((result.error as any).code === 'ETIMEDOUT') {
        return createErrorChunk('Espanso log command timed out.');
      }
      return createErrorChunk('Espanso log command failed to execute.');
    }

    if (result.signal) {
      return createErrorChunk(`Espanso log command terminated by signal: ${result.signal}`);
    }

    if (result.status === null) {
      return createErrorChunk('Espanso log command terminated abnormally.');
    }

    if (result.status !== 0) {
      return createErrorChunk(`Espanso log command returned non-zero exit code: ${result.status}`);
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
      timestamp: new Date().toISOString(), // Mocking timestamp as espanso log lines might not have parseable timestamps
      level: line.toLowerCase().includes('error') ? 'error' : line.toLowerCase().includes('warn') ? 'warn' : 'info',
      message: line
    }));
  } catch (e: any) {
    return [{
      timestamp: new Date().toISOString(),
      level: 'error',
      message: e.message || 'Unknown error while reading espanso logs.'
    }];
  }
}
