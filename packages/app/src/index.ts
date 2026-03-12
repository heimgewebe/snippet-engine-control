export * from './ports/engine';
export * from './services/workspace';
export * from './services/validation';
export * from './services/apply';
export * from './services/draft';
export * from './services/plan';
export * from './services/snapshot';
export * from './services/preview';

// --- Phase-1 API Surface ---
// The following models (workspace, store) are exposed temporarily as a root integration API
// for internal consumers (e.g., the CLI daemon). This surface is experimental and may change
// without compatibility guarantees as Phase 1 progresses.
export * from './model/workspace';
export * from './model/store';
