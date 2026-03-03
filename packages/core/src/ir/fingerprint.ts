// fingerprint.ts - stable IDs
import * as crypto from 'crypto';
import { Snippet } from '../model/snippet';
import { normalize } from './normalize';

function stableStringify(value: any): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    const arrStr = value.map(v => stableStringify(v) ?? 'null').join(',');
    return `[${arrStr}]`;
  }
  const keys = Object.keys(value).sort();
  const objStr = keys.map(k => {
    const vStr = stableStringify(value[k]);
    return vStr !== undefined ? `${JSON.stringify(k)}:${vStr}` : undefined;
  }).filter(s => s !== undefined).join(',');
  return `{${objStr}}`;
}

export function fingerprint(snippet: Snippet): string {
  const normalized = normalize(snippet);

  // Create a canonical representation without origin/path/time
  const canonical: any = {};
  if (normalized.triggers && normalized.triggers.length > 0) canonical.triggers = normalized.triggers;
  if (normalized.body !== undefined) canonical.body = normalized.body;

  if (normalized.constraints && Object.keys(normalized.constraints).length > 0) {
    canonical.constraints = normalized.constraints;
  }

  if (normalized.tags && normalized.tags.length > 0) {
    canonical.tags = normalized.tags;
  }

  const jsonString = stableStringify(canonical) ?? '{}';
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}
