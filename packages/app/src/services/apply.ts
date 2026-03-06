import { ExportPlan } from '@snippet-engine-control/core';
import { EngineWritePort } from '../ports/engine';

export class ApplyService {
  constructor(private port: EngineWritePort) {}

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
