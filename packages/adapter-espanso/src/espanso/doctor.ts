import { spawnSync } from 'child_process';
import { RuntimeHealth } from '@snippet-engine-control/core';

const SPAWN_TIMEOUT_MS = 5000;

// doctor.ts - common failure modes (X11/Wayland, service, etc.)
export function runDoctor(): RuntimeHealth {
  try {
    const result = spawnSync('espanso', ['status'], { encoding: 'utf8', timeout: SPAWN_TIMEOUT_MS });

    if (result.error) {
      if ((result.error as any).code === 'ETIMEDOUT') {
        return { status: 'error', message: 'Espanso status command timed out.' };
      }
      return { status: 'error', message: 'Espanso command not found or failed to execute.' };
    }

    if (result.signal) {
      return { status: 'error', message: `Espanso status command terminated by signal: ${result.signal}` };
    }

    if (result.status === null) {
      return { status: 'error', message: 'Espanso status command terminated abnormally without an exit code.' };
    }

    const output = (result.stdout + result.stderr).toLowerCase();

    if (output.includes('not running')) {
      return { status: 'error', message: 'Espanso service is not running.' };
    }

    if (output.includes('wayland') && output.includes('warning')) {
      return { status: 'degraded', message: 'Espanso running with Wayland warnings.' };
    }

    if (result.status !== 0) {
      return { status: 'error', message: 'Espanso status returned a non-zero exit code.' };
    }

    return { status: 'ok', message: 'Espanso service is healthy.' };
  } catch (err: any) {
    return { status: 'unknown', message: err.message || 'Unknown error while running espanso doctor checks.' };
  }
}
