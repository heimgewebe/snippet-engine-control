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
      // allow options.inputPath to be undefined, as the adapter may have a default behavior or
      // rely on environment variables (like SEC_SNIPPETS) which we want to preserve.
      return this.engine.readSnippets(options.inputPath);
    }
  }

  public validate(options: ValidateOptions): ValidationResult {
    const snippets = this.loadSnippets(options);
    const validationService = new ValidationService();
    return validationService.validateSnippets(snippets);
  }
}
