// write.ts - write IR back to espanso YAML
import * as fs from 'fs';
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
      const tmpPath = change.file + '.tmp';
      fs.writeFileSync(tmpPath, change.content, 'utf8');
      fs.renameSync(tmpPath, change.file);
    } else if (change.action === 'delete') {
      if (fs.existsSync(change.file)) {
        fs.unlinkSync(change.file);
      }
    }
  }
}
