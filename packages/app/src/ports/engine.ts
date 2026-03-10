import { Snippet, ExportPlan, VerificationResult, RuntimeHealth, LogOptions, RuntimeLogChunk } from '@snippet-engine-control/core';

export interface EngineReadPort {
  /**
   * Reads snippets from a source path
   */
  readSnippets(inputPath?: string): Snippet[];

  /**
   * Reads snippets directly from the engine's configuration directory
   */
  readSnippetsFromEngine(dir?: string): Snippet[];
}

export interface EngineWritePort {
  /**
   * Writes the given export plan to the engine
   */
  writeSnippets(plan: ExportPlan): void;
}

export interface EngineRuntimePort {
  /**
   * Verifies the written plan against the runtime or configuration
   */
  verify(plan: ExportPlan): VerificationResult;

  /**
   * Retrieves the engine's health status
   */
  health(): RuntimeHealth;

  /**
   * Optional: Retrieves runtime logs
   */
  logs?(opts?: LogOptions): RuntimeLogChunk[];
}

export interface EngineSnapshotPort {
  /**
   * Creates a backup/snapshot of the engine's current configuration state.
   * Returns a snapshot ID or identifier.
   */
  createSnapshot(): string;

  /**
   * Restores the engine's configuration from a given snapshot ID.
   */
  restoreSnapshot(snapshotId: string): void;

  /**
   * Rolls back to the most recent snapshot.
   * Returns true if a rollback occurred, false if no snapshot was found.
   */
  rollbackLatestSnapshot(): boolean;
}
