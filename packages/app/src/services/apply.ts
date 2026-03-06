import { ExportPlan } from '@snippet-engine-control/core';

export interface WritePort {
  writeSnippets(plan: ExportPlan): void;
}

export class ApplyService {
  constructor(private port: WritePort) {}

  public applyPlan(plan: ExportPlan, isDryRun: boolean = true): boolean {
    if (plan.unsupportedFeatures && plan.unsupportedFeatures.length > 0) {
      throw new Error(`Cannot apply plan with unsupported features:\n${plan.unsupportedFeatures.join('\n')}`);
    }

    if (isDryRun) {
      return false; // did not write
    }

    this.port.writeSnippets(plan);
    return true; // did write
  }
}
