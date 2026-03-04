import { buildExportPlan } from './plan';

export function exportPlan(options: { inputPath?: string; engine?: string; dir?: string }) {
  const plan = buildExportPlan(options);
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}
