import { spawnSync } from 'child_process';
import { LogOptions, RuntimeLogChunk } from '@snippet-engine-control/core';

export function restartEspanso(): boolean {
  try {
    const result = spawnSync('espanso', ['restart'], { encoding: 'utf8' });
    return result.status === 0;
  } catch (e) {
    return false;
  }
}

export function logs(opts?: LogOptions): RuntimeLogChunk[] {
  try {
    // Note: espanso log doesn't strictly stream JSON in older versions,
    // so this is a best-effort structural parse or raw return.
    // For MVP sovereignty, we grab the raw log tail and wrap it.
    const args = ['log'];
    const result = spawnSync('espanso', args, { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      return [];
    }

    const lines = result.stdout.split('\n').filter(l => l.trim().length > 0);
    const tailLines = opts?.tail ? lines.slice(-opts.tail) : lines;

    return tailLines.map(line => ({
      timestamp: new Date().toISOString(), // Mocking timestamp as espanso log lines might not have parseable timestamps
      level: line.toLowerCase().includes('error') ? 'error' : line.toLowerCase().includes('warn') ? 'warn' : 'info',
      message: line
    }));
  } catch (e) {
    return [];
  }
}
