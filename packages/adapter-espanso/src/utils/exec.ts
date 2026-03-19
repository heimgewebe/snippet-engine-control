import cp from 'child_process';

export interface ExecResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut?: boolean;
  signal?: string | null;
  exitCode?: number | null;
}

export const SPAWN_TIMEOUT_MS = 5000;

export function runCommand(cmd: string, args: string[], timeoutMs: number = SPAWN_TIMEOUT_MS): ExecResult {
  try {
    const result = cp.spawnSync(cmd, args, { encoding: 'utf8', timeout: timeoutMs });

    const timedOut = result.error && (result.error as any).code === 'ETIMEDOUT';
    const error = result.error ? result.error.message : undefined;

    const ok = !result.error && !result.signal && result.status === 0;

    return {
      ok: Boolean(ok),
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      error,
      timedOut: Boolean(timedOut),
      signal: result.signal || null,
      exitCode: result.status ?? null,
    };
  } catch (e: any) {
    return {
      ok: false,
      stdout: '',
      stderr: '',
      error: e.message || 'Unknown error occurred during execution.',
    };
  }
}
