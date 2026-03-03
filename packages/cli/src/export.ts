import { ExportPlan } from '@snippet-engine-control/core';

export function exportPlan(inputPath?: string) {
  // Minimal MVP: empty or "no changes" plan, deterministic output
  const plan: ExportPlan = {
    changes: []
  };

  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}
