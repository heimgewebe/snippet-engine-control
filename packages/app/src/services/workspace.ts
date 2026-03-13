import { EngineReadPort } from '../ports/engine';
import { Snippet } from '@snippet-engine-control/core';
import { ValidationService, ValidationResult } from './validation';

export interface ValidateOptions {
  inputPath?: string;
  engine?: string;
  dir?: string;
}

export class WorkspaceService {
  constructor(private engine: EngineReadPort) {}

  public loadSnippets(options: ValidateOptions): Snippet[] {
    if (options.engine === 'espanso') {
      return this.engine.readSnippetsFromEngine(options.dir);
    } else {
      // Orchestration layer decides whether to be tolerant.
      // If no explicit path or Env default (like SEC_SNIPPETS) was provided, return empty.
      if (!options.inputPath) {
        return [];
      }
      return this.engine.readSnippets(options.inputPath);
    }
  }

  public validate(options: ValidateOptions): ValidationResult {
    const snippets = this.loadSnippets(options);
    const validationService = new ValidationService();
    return validationService.validateSnippets(snippets);
  }
}
