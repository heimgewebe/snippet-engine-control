// normalize.ts - canonicalization
import { Snippet } from '../model/snippet';

export function normalize(snippet: Snippet): Snippet {
  const normalized: Snippet = {
    ...snippet,
    triggers: Array.from(new Set(snippet.triggers)).sort(),
    body: snippet.body.replace(/\r\n/g, '\n'),
  };

  if (normalized.tags) {
    normalized.tags = Array.from(new Set(normalized.tags)).sort();
  }

  return normalized;
}
