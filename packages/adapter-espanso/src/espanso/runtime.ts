import { ExportPlan, VerificationResult, RuntimeHealth } from '@snippet-engine-control/core';
import { discoverDirs } from './discover';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'yaml';

export function verify(plan: ExportPlan, targetDir?: string): VerificationResult {
  const errors: string[] = [];

  for (const change of plan.changes) {
    if (!change.file) continue;

    if (change.action === 'create' || change.action === 'update') {
      if (!fs.existsSync(change.file)) {
        errors.push(`File missing after apply: ${change.file}`);
        continue;
      }

      let content: string;
      try {
        content = fs.readFileSync(change.file, 'utf8');
      } catch (err: any) {
        errors.push(`Could not read file ${change.file}: ${err.message}`);
        continue;
      }

      try {
        yaml.parse(content);
      } catch (err: any) {
        errors.push(`Invalid YAML in file ${change.file}: ${err.message}`);
      }

      if (change.afterHash) {
        const currentHash = crypto.createHash('sha256').update(content).digest('hex');
        if (currentHash !== change.afterHash) {
          errors.push(`Content hash mismatch for ${change.file}. Expected ${change.afterHash}, got ${currentHash}`);
        }
      }
    } else if (change.action === 'delete') {
      if (fs.existsSync(change.file)) {
        errors.push(`File was not deleted: ${change.file}`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings: [] };
  }

  return { ok: true, errors: [], warnings: [] };
}

export function health(targetDir?: string): RuntimeHealth {
  try {
    const dirs = targetDir ? [targetDir] : discoverDirs();
    if (dirs.length === 0) {
      return { status: 'error', message: 'Could not discover any Espanso configuration directory.' };
    }

    const configDir = dirs[0];

    if (!fs.existsSync(configDir)) {
      return { status: 'error', message: `Config directory does not exist: ${configDir}` };
    }

    if (!fs.statSync(configDir).isDirectory()) {
      return { status: 'error', message: `Config path is not a directory: ${configDir}` };
    }

    let isReadable = false;
    try {
      fs.accessSync(configDir, fs.constants.R_OK);
      isReadable = true;
    } catch {
      // ignore
    }

    if (!isReadable) {
      return { status: 'error', message: `Config directory is not readable: ${configDir}` };
    }

    const matchDir = path.join(configDir, 'match');
    if (!fs.existsSync(matchDir)) {
      return { status: 'degraded', message: `match/ directory is missing in ${configDir}` };
    }

    if (!fs.statSync(matchDir).isDirectory()) {
      return { status: 'error', message: `match/ path is not a directory: ${matchDir}` };
    }

    let isMatchReadable = false;
    try {
      fs.accessSync(matchDir, fs.constants.R_OK);
      isMatchReadable = true;
    } catch {
      // ignore
    }

    if (!isMatchReadable) {
      return { status: 'degraded', message: `match/ directory is not readable: ${matchDir}` };
    }

    return { status: 'ok', message: `Espanso configuration directory found and readable at ${configDir}` };
  } catch (err: any) {
    return { status: 'unknown', message: `Health check failed unexpectedly: ${err.message}` };
  }
}
