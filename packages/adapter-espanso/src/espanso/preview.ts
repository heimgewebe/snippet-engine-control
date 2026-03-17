import { Snippet, PreviewResult, PreviewContext, simulateExpansion } from '@snippet-engine-control/core';

export function preview(snippet: Snippet, ctx: PreviewContext): PreviewResult {
  const fallback = simulateExpansion(snippet);
  if (!snippet.body) {
    return { ...fallback, trace: ['No body to expand.'] };
  }

  const trace: string[] = [];
  let expanded = snippet.body;

  // Extremely naive Espanso-specific variable expansion simulation for the MVP
  // Real implementation would parse the Espanso YAML structure or run espanso match

  if (expanded.includes('{{clipboard}}')) {
    const clipboardVal = ctx.clipboardText ?? '[Mock Clipboard Content]';
    expanded = expanded.replace(/\{\{clipboard\}\}/g, clipboardVal);
    trace.push(`Expanded {{clipboard}} to "${clipboardVal}"`);
  }

  // Date match e.g. {{mydate}}
  const dateRegex = /\{\{([^}]+date[^}]*)\}\}/gi;
  expanded = expanded.replace(dateRegex, (match, varName) => {
    const dateVal = ctx.currentDate ?? new Date().toISOString().split('T')[0];
    trace.push(`Expanded date variable {{${varName}}} to "${dateVal}"`);
    return dateVal;
  });

  // Determine if there are still unresolved templates
  const hasUnresolved = /\{\{.*\}\}/.test(expanded);
  let warnings: string[] | undefined;

  if (hasUnresolved) {
    trace.push('Warning: Unresolved template variables remain.');
    warnings = ['Contains unresolved template variables after engine expansion.'];
  }

  return {
    text: expanded,
    isTemplate: hasUnresolved,
    warnings,
    trace
  };
}
