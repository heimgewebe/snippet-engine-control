export interface EngineCapabilities {
  supportsWordBoundary: boolean;
  supportsMultiline: boolean;
  supportsVarsShell: boolean;
  supportsAppSpecific: boolean;
  supportsHotkeys: boolean;
}

export interface VerificationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface RuntimeHealth {
  status: 'ok' | 'degraded' | 'error' | 'unknown';
  message?: string;
  version?: string;
}

export interface LogOptions {
  tail?: number;
}

export interface RuntimeLogChunk {
  timestamp: string;
  level: string;
  message: string;
}
