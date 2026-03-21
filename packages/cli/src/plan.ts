import * as fs from 'fs';
import * as path from 'path';
import { ExportPlan, Snippet } from '@snippet-engine-control/core';
import { PlanService } from '@snippet-engine-control/app';
import { readSnippets, discoverDirs } from '@snippet-engine-control/adapter-espanso';

export function buildExportPlan(options: { engine?: string; dir?: string; inputPath?: string }, sourceSnippets?: Snippet[]): ExportPlan {
  if (options.engine !== 'espanso') {
    return { changes: [], unsupportedFeatures: [] };
  }

  const snippets = sourceSnippets || (options.inputPath ? readSnippets(options.inputPath) : undefined);

  if (!snippets) {
    console.error('Input path or sourceSnippets required for export/apply');
    process.exit(2);
  }

  // Determine destination dir
  let targetDir = options.dir;
  if (!targetDir) {
    const discovered = discoverDirs();
    if (discovered.length === 0) {
      console.error('Could not discover espanso config dir');
      process.exit(2);
    }
    targetDir = discovered[0];
  }

  const targetFile = path.resolve(targetDir, 'match', 'sec.generated.yml');

  let fileExists = false;
  let existingContent: string | undefined = undefined;

  try {
    existingContent = fs.readFileSync(targetFile, 'utf8');
    fileExists = true;
  } catch (e) {
    // Treat missing target file as absent existing content; rethrow other read errors
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e;
    }
  }

  const planService = new PlanService();
  return planService.buildPlan(snippets, {
    engine: options.engine,
    targetFile,
    fileExists,
    existingContent
  });
}
