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
      // Orchestration layer resolves environment defaults and decides whether to be tolerant.
      const inputPath = options.inputPath ?? process.env.SEC_SNIPPETS;
      if (!inputPath) {
        return [];
      }
      return this.engine.readSnippets(inputPath);
    }
  }

  public validate(options: ValidateOptions): ValidationResult {
    const snippets = this.loadSnippets(options);
    const validationService = new ValidationService();
    return validationService.validateSnippets(snippets);
  }
}
