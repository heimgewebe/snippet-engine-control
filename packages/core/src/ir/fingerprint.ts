// fingerprint.ts - stable IDs
import * as crypto from 'crypto';
import { Snippet } from '../model/snippet';
import { normalize } from './normalize';

export function fingerprint(snippet: Snippet): string {
  const normalized = normalize(snippet);

  // Create a canonical representation without origin/path/time
  const canonical = {
    triggers: normalized.triggers,
    body: normalized.body,
    constraints: normalized.constraints,
    tags: normalized.tags,
  };

  const jsonString = JSON.stringify(canonical);
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}
