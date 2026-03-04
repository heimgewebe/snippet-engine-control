// plan.ts - what will change (diff plan)

export interface ExportChange {
  file: string;
  action: 'create' | 'update' | 'delete';
  content?: string;
  beforeHash?: string;
  afterHash?: string;
  reason?: string;
  originPath?: string;
}

export interface ExportPlan {
  changes: ExportChange[];
  unsupportedFeatures?: string[];
}
