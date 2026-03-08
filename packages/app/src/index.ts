export * from './ports/engine';
export * from './services/workspace';
export * from './services/snippet';
export * from './services/validation';
export * from './services/apply';

// --- Phase-1 API Surface ---
// The following models (workspace, store) are exposed temporarily as a stable root API
// for integration (e.g., the CLI daemon). Their shapes are expected to evolve as Phase 1 progresses.
export * from './model/workspace';
export * from './model/store';
