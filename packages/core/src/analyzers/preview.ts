import { Snippet } from '../model/snippet';
import { PreviewResult } from '../model/preview';

/**
 * A static and template-aware expansion simulator.
 * Identifies if the body contains basic templates like `{{...}}`.
 */
export function simulateExpansion(snippet: Snippet): PreviewResult {
  if (!snippet.body) {
    return {
      text: '',
      isTemplate: false
    };
  }

  // Very basic check for template variables: things like {{date}} or {{clipboard}}
  const isTemplate = /\{\{.*\}\}/.test(snippet.body);
  const warnings: string[] = [];

  if (isTemplate) {
    warnings.push('Contains template variables that may not be fully resolved in static preview.');
  }

  return {
    text: snippet.body,
    isTemplate,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}
