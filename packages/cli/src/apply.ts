import { buildExportPlan } from './plan';
import { writeSnippets } from '@snippet-engine-control/adapter-espanso';

export function apply(options: { inputPath?: string; engine?: string; dir?: string; isDryRun?: boolean }) {
  const plan = buildExportPlan(options);

  if (plan.unsupportedFeatures && plan.unsupportedFeatures.length > 0) {
    console.error('Cannot apply plan with unsupported features:');
    for (const feat of plan.unsupportedFeatures) {
      console.error(`- ${feat}`);
    }
    process.exit(1);
  }

  const isDryRun = options.isDryRun !== false;

  if (isDryRun) {
    console.log('Dry run: skipping write');
    console.log(JSON.stringify(plan, null, 2));
    process.exit(0);
  } else {
    try {
      writeSnippets(plan);
      console.log('Successfully applied snippets.');
      process.exit(0);
    } catch (e: any) {
      console.error(`Error applying snippets: ${e.message}`);
      process.exit(1);
    }
  }
}
