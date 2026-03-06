import { EnginePort } from '../ports/engine';
import {
  Snippet,
  ExportPlan,
  normalize,
  analyzeConflicts,
  analyzeBoundaries,
  analyzeEncoding
} from '@snippet-engine-control/core';

export interface ValidateOptions {
  inputPath?: string;
  engine?: string;
  dir?: string;
}

export interface ValidationResult {
  hasErrors: boolean;
  collisions: string[];
  ambiguous: string[];
  encoding: string[];
}

// NOTE: buildExportPlan logic remains closely tied to the adapter implementation
// so we'll allow passing in the pre-computed plan for now, or building it via the engine port.
// For a fully engine-neutral application layer, the engine port should provide a `buildDryRunPlan(snippets)` method.

export class WorkspaceService {
  constructor(private engine: EnginePort) {}

  public loadSnippets(options: ValidateOptions): Snippet[] {
    if (options.engine === 'espanso') {
      return this.engine.readSnippetsFromEngine(options.dir);
    } else {
      if (!options.inputPath) {
        throw new Error('Input path required if not using --engine=espanso');
      }
      return this.engine.readSnippets(options.inputPath);
    }
  }

  public validate(options: ValidateOptions): ValidationResult {
    const snippets = this.loadSnippets(options);
    return this.validateSnippets(snippets);
  }

  public validateSnippets(snippets: Snippet[]): ValidationResult {
    const encodingDiag = analyzeEncoding(snippets);
    const normalizedSnippets = snippets.map(normalize);
    const conflictsDiag = analyzeConflicts(normalizedSnippets);
    const boundariesDiag = analyzeBoundaries(normalizedSnippets);

    const formatIssue = (issue: string, snippetId?: string) => {
      const matchedPaths = new Set<string>();

      if (snippetId) {
        const s = normalizedSnippets.find(s => s.id === snippetId);
        if (s?.origin?.path) matchedPaths.add(s.origin.path);
      }

      const snippetMatchRegex = /Snippet\s+'([^']+)'/g;
      let match;
      while ((match = snippetMatchRegex.exec(issue)) !== null) {
        const id = match[1];
        const s = normalizedSnippets.find(s => s.id === id);
        if (s?.origin?.path) matchedPaths.add(s.origin.path);
      }

      const idsMatch = issue.match(/used by ids:\s*([^\n]+)/);
      if (idsMatch && idsMatch[1]) {
        const ids = idsMatch[1].split(',').map(id => id.trim()).filter(id => id.length > 0);
        ids.forEach(id => {
          const s = normalizedSnippets.find(s => s.id === id);
          if (s?.origin?.path) matchedPaths.add(s.origin.path);
        });
      }

      if (matchedPaths.size > 0) {
        return `${issue} (paths: ${Array.from(matchedPaths).join(', ')})`;
      }
      return issue;
    };

    const collisions = conflictsDiag.triggerCollisions.map((i: string) => formatIssue(i));
    const ambiguous = boundariesDiag.ambiguousBoundaries.map((i: string) => formatIssue(i));
    const encoding = encodingDiag.encodingIssues.map((i: string) => formatIssue(i));

    return {
      hasErrors: collisions.length > 0,
      collisions,
      ambiguous,
      encoding
    };
  }

  public applyPlan(plan: ExportPlan, isDryRun: boolean = true) {
    if (plan.unsupportedFeatures && plan.unsupportedFeatures.length > 0) {
      throw new Error(`Cannot apply plan with unsupported features:\n${plan.unsupportedFeatures.join('\n')}`);
    }

    if (isDryRun) {
      return false; // did not write
    }

    this.engine.writeSnippets(plan);
    return true; // did write
  }
}
