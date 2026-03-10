import { ExportPlan, VerificationResult } from '@snippet-engine-control/core';
import { EngineWritePort, EngineRuntimePort, EngineSnapshotPort } from '../ports/engine';

export interface ApplyServiceOptions {
  writePort: EngineWritePort;
  runtimePort?: EngineRuntimePort;
  snapshotPort?: EngineSnapshotPort;
}

export class ApplyService {
  constructor(private options: ApplyServiceOptions) {
    // Backwards compatibility for single-argument initialization
    if (arguments.length === 1 && !('writePort' in options)) {
      this.options = { writePort: options as any as EngineWritePort };
    }
  }

  public applyPlan(plan: ExportPlan, isDryRun: boolean = true): boolean {
    if (plan.unsupportedFeatures && plan.unsupportedFeatures.length > 0) {
      throw new Error(`Cannot apply plan with unsupported features:\n${plan.unsupportedFeatures.join('\n')}`);
    }

    if (isDryRun) {
      return false; // did not write
    }

    let snapshotId: string | undefined;

    if (this.options.snapshotPort) {
      snapshotId = this.options.snapshotPort.createSnapshot();
    }

    try {
      this.options.writePort.writeSnippets(plan);
    } catch (writeErr: any) {
      if (this.options.snapshotPort && snapshotId) {
        try {
          this.options.snapshotPort.restoreSnapshot(snapshotId);
        } catch (rollbackErr: any) {
          throw new Error(`Write failed and rollback also failed. Write Error: ${writeErr.message} | Rollback Error: ${rollbackErr.message}`);
        }
      }
      throw writeErr;
    }

    if (this.options.runtimePort) {
      const verification = this.options.runtimePort.verify(plan);
      if (!verification.ok) {
        if (this.options.snapshotPort && snapshotId) {
          try {
            this.options.snapshotPort.restoreSnapshot(snapshotId);
          } catch (rollbackErr: any) {
            throw new Error(`Verification failed and rollback also failed. Errors: ${verification.errors.join(', ')}`);
          }
          throw new Error(`Apply verification failed, rolled back to previous state. Errors: ${verification.errors.join(', ')}`);
        }
        throw new Error(`Apply verification failed, but no snapshot was available for rollback. Errors: ${verification.errors.join(', ')}`);
      }
    }

    return true; // did write and verify successfully
  }
}
