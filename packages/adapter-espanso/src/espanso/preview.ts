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
    const clipboardVal = ctx.clipboardText || '[Mock Clipboard Content]';
    expanded = expanded.replace(/\{\{clipboard\}\}/g, clipboardVal);
    trace.push(`Expanded {{clipboard}} to "${clipboardVal}"`);
  }

  // Date match e.g. {{mydate}}
  const dateRegex = /\{\{([^}]+date[^}]*)\}\}/i;
  const dateMatch = expanded.match(dateRegex);
  if (dateMatch) {
     const dateVal = ctx.currentDate || new Date().toISOString().split('T')[0];
     expanded = expanded.replace(dateRegex, dateVal);
     trace.push(`Expanded date variable {{${dateMatch[1]}}} to "${dateVal}"`);
  }

  // Determine if there are still unresolved templates
  const hasUnresolved = /\{\{.*\}\}/.test(expanded);
  if (hasUnresolved) {
     trace.push('Warning: Unresolved template variables remain.');
  }

  return {
    text: expanded,
    isTemplate: hasUnresolved,
    warnings: fallback.warnings,
    trace
  };
}
