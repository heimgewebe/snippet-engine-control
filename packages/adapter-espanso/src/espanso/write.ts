// write.ts - write IR back to espanso YAML
import * as fs from 'fs';
import * as path from 'path';
import { ExportPlan } from '@snippet-engine-control/core';

export function writeSnippets(plan: ExportPlan): void {
  if (plan.unsupportedFeatures && plan.unsupportedFeatures.length > 0) {
    throw new Error('Cannot apply plan with unsupported features: ' + plan.unsupportedFeatures.join(', '));
  }

  for (const change of plan.changes) {
    if (change.action === 'create' || change.action === 'update') {
      if (!change.file || typeof change.content !== 'string') {
        continue;
      }

      const dirPath = path.dirname(change.file);
      fs.mkdirSync(dirPath, { recursive: true });
      // Only enforce 0o700 if we are on a non-Windows platform
      if (process.platform !== 'win32') {
        fs.chmodSync(dirPath, 0o700);
      }

      const tmpPath = change.file + '.tmp';
      if (fs.existsSync(tmpPath)) {
        fs.rmSync(tmpPath, { force: true });
      }
      fs.writeFileSync(tmpPath, change.content, { encoding: 'utf8', mode: 0o600 });
      if (process.platform !== 'win32') {
        fs.chmodSync(tmpPath, 0o600);
      }

      try {
        if (fs.existsSync(change.file)) {
          fs.rmSync(change.file, { force: true });
        }
        fs.renameSync(tmpPath, change.file);
        if (process.platform !== 'win32') {
          fs.chmodSync(change.file, 0o600);
        }
      } catch (err) {
        if (fs.existsSync(tmpPath)) {
          fs.rmSync(tmpPath, { force: true });
        }
        throw err;
      }
    } else if (change.action === 'delete') {
      fs.rmSync(change.file, { force: true });
    }
  }
}
