import { Snippet, ExportPlan } from '@snippet-engine-control/core';

export interface EnginePort {
  /**
   * Reads snippets from a source path
   */
  readSnippets(inputPath?: string): Snippet[];

  /**
   * Reads snippets directly from the engine's configuration directory
   */
  readSnippetsFromEngine(dir?: string): Snippet[];

  /**
   * Writes the given export plan to the engine
   */
  writeSnippets(plan: ExportPlan): void;
}
