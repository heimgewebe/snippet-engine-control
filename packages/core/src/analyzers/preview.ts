import { Snippet } from '../model/snippet';

/**
 * An MVP expansion simulator.
 * For now, it simply returns the body of the snippet.
 * Future iterations could interpret placeholders (e.g. {{date}}, {{clipboard}}).
 */
export function simulateExpansion(snippet: Snippet): string {
  if (!snippet.body) {
    return '';
  }
  return snippet.body;
}
