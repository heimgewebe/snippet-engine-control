import { buildExportPlan } from './plan';
import { writeSnippets, createSnapshot, restoreSnapshot, rollbackLatestSnapshot, verify, health } from '@snippet-engine-control/adapter-espanso';
import { ApplyService } from '@snippet-engine-control/app';

export function apply(options: { inputPath?: string; engine?: string; dir?: string; isDryRun?: boolean }) {
  const plan = buildExportPlan(options); // using existing builder for now

  const isDryRun = options.isDryRun !== false;

  const applyService = new ApplyService({
    writePort: { writeSnippets },
    snapshotPort: {
      createSnapshot: () => createSnapshot(options.dir),
      restoreSnapshot: (id: string) => restoreSnapshot(id, options.dir),
      rollbackLatestSnapshot: () => rollbackLatestSnapshot(options.dir)
    },
    runtimePort: {
      verify: (p) => verify(p, options.dir),
      health: () => health(options.dir)
    }
  });

  try {
    const didWrite = applyService.applyPlan(plan, isDryRun);
    if (!didWrite) {
      console.log('Dry run: skipping write');
      console.log(JSON.stringify(plan, null, 2));
    } else {
      console.log('Successfully applied snippets.');
    }
    process.exit(0);
  } catch (e: any) {
    console.error(`Error applying snippets: ${e.message}`);
    process.exit(1);
  }
}
