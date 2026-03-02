// plan.ts - what will change (diff plan)
export interface ExportPlan {
  changes: Array<{
    file: string;
    action: 'create' | 'update' | 'delete';
    content?: string;
  }>;
}
