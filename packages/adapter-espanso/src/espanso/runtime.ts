import { ExportPlan, VerificationResult, RuntimeHealth } from '@snippet-engine-control/core';
import { readSnippetsFromEspanso } from './read';
import { discoverDirs } from './discover';
import * as fs from 'fs';
import * as path from 'path';

export function verify(plan: ExportPlan, targetDir?: string): VerificationResult {
  const dirs = targetDir ? [targetDir] : discoverDirs();
  if (dirs.length === 0) {
    return { ok: false, errors: ['Could not discover espanso config dir for verification'], warnings: [] };
  }

  const matchDir = path.join(dirs[0], 'match');
  const targetFile = path.join(matchDir, 'sec.generated.yml');

  if (!fs.existsSync(targetFile)) {
    if (plan.changes.some(c => c.action !== 'delete')) {
       return { ok: false, errors: ['Generated file sec.generated.yml is missing after apply.'], warnings: [] };
    }
  }

  try {
    // Attempting to read them back to ensure YAML is valid
    readSnippetsFromEspanso(dirs[0]);
  } catch (err: any) {
    return { ok: false, errors: [`Post-apply verification failed: ${err.message}`], warnings: [] };
  }

  return { ok: true, errors: [], warnings: [] };
}

export function health(): RuntimeHealth {
  // For MVP minimal safety, we assume if we can't run `espanso status`, we return unknown.
  // We'll leave it as mock for now or run a lightweight check.
  return { status: 'unknown', message: 'Espanso runtime check not fully implemented' };
}
