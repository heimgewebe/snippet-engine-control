import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import * as yaml from 'yaml';
import { ExportPlan, ExportChange, Snippet } from '@snippet-engine-control/core';
import { readSnippets, discoverDirs } from '@snippet-engine-control/adapter-espanso';

export function buildExportPlan(options: { engine?: string; dir?: string; inputPath?: string }): ExportPlan {
  if (options.engine !== 'espanso') {
    return { changes: [], unsupportedFeatures: [] };
  }

  if (!options.inputPath) {
    console.error('Input path required for export/apply');
    process.exit(2);
  }

  const sourceSnippets = readSnippets(options.inputPath);
  const plan: ExportPlan = { changes: [], unsupportedFeatures: [] };

  const matches: any[] = [];

  for (const snippet of sourceSnippets) {
    // Collect unsupported features
    if (snippet.constraints && snippet.constraints.localeHints) {
      plan.unsupportedFeatures!.push(`Snippet '${snippet.id}' uses unsupported feature: localeHints`);
    }
    if (snippet.tags && snippet.tags.length > 0) {
      plan.unsupportedFeatures!.push(`Snippet '${snippet.id}' uses unsupported feature: tags`);
    }

    const match: any = { replace: snippet.body };

    if (snippet.triggers.length === 1) {
      match.trigger = snippet.triggers[0];
    } else if (snippet.triggers.length > 1) {
      match.triggers = snippet.triggers;
    }

    if (snippet.constraints) {
      if (snippet.constraints.wordBoundary) {
        match.word = true;
      }
      if (snippet.constraints.appInclude && snippet.constraints.appInclude.length > 0) {
        match.app_include = snippet.constraints.appInclude;
      }
      if (snippet.constraints.appExclude && snippet.constraints.appExclude.length > 0) {
        match.app_exclude = snippet.constraints.appExclude;
      }
    }

    matches.push(match);
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

  const content = yaml.stringify({ matches });
  const afterHash = crypto.createHash('sha256').update(content).digest('hex');

  let beforeHash: string | undefined;
  let action: 'create' | 'update' | 'delete' = 'create';

  try {
    if (fs.existsSync(targetFile)) {
      const existingContent = fs.readFileSync(targetFile, 'utf8');
      beforeHash = crypto.createHash('sha256').update(existingContent).digest('hex');
      action = 'update';
    }
  } catch (e) {
    // Ignore if file can't be read
  }

  plan.changes.push({
    file: targetFile,
    action,
    content,
    beforeHash,
    afterHash,
    originPath: targetFile
  });

  return plan;
}
