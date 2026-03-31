import * as crypto from 'crypto';
import * as yaml from 'yaml';
import { ExportPlan, Snippet } from '@snippet-engine-control/core';

export interface PlanOptions {
  engine?: string;
  targetFile: string;
  fileExists: boolean;
  existingContent?: string;
}

interface EspansoMatch {
  replace: string;
  trigger?: string;
  triggers?: string[];
  word?: boolean;
  app_include?: string[];
  app_exclude?: string[];
}

export class PlanService {
  public buildPlan(snippets: Snippet[], options: PlanOptions): ExportPlan {
    if (options.engine !== 'espanso') {
      return { changes: [], unsupportedFeatures: [] };
    }

    const plan: ExportPlan = { changes: [], unsupportedFeatures: [] };
    const matches: EspansoMatch[] = [];

    for (const snippet of snippets) {
      // Collect unsupported features
      if (snippet.constraints && snippet.constraints.localeHints) {
        plan.unsupportedFeatures!.push(`Snippet '${snippet.id}' uses unsupported feature: localeHints`);
      }
      if (snippet.tags && snippet.tags.length > 0) {
        plan.unsupportedFeatures!.push(`Snippet '${snippet.id}' uses unsupported feature: tags`);
      }

      const match: EspansoMatch = { replace: snippet.body };

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

    const content = yaml.stringify({ matches });
    const afterHash = crypto.createHash('sha256').update(content).digest('hex');

    let beforeHash: string | undefined;
    let action: 'create' | 'update' | 'delete' = options.fileExists ? 'update' : 'create';

    if (options.fileExists && options.existingContent !== undefined) {
      beforeHash = crypto.createHash('sha256').update(options.existingContent).digest('hex');
    }

    plan.changes.push({
      file: options.targetFile,
      action,
      content,
      beforeHash,
      afterHash,
      originPath: options.targetFile
    });

    return plan;
  }
}
