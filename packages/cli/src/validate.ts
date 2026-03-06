import { readSnippets, readSnippetsFromEspanso } from '@snippet-engine-control/adapter-espanso';
import { WorkspaceService, ValidateOptions } from '@snippet-engine-control/app';

export function validate(options: ValidateOptions | string = {}) {
  console.log('Validating snippets...');

  const opts = typeof options === 'string' ? { inputPath: options } : options;

  // The CLI connects the app layer to the concrete espanso adapter
  const workspaceService = new WorkspaceService({
    readSnippets,
    readSnippetsFromEngine: readSnippetsFromEspanso,
    writeSnippets: () => {}
  });

  let result;
  try {
    result = workspaceService.validate(opts);
  } catch (error) {
    console.error(`Input error: ${(error as Error).message}`);
    process.exit(2);
  }

  if (result.collisions.length > 0) {
    console.error('Validation failed: Trigger collisions found:');
    result.collisions.forEach((collision: string) => {
      console.error(`- ${collision}`);
    });
  }

  if (result.ambiguous.length > 0) {
    console.warn('Warnings: Ambiguous boundaries found:');
    result.ambiguous.forEach((issue: string) => {
      console.warn(`- ${issue}`);
    });
  }

  if (result.encoding.length > 0) {
    console.warn('Warnings: Encoding issues found:');
    result.encoding.forEach((issue: string) => {
      console.warn(`- ${issue}`);
    });
  }

  if (result.hasErrors) {
    process.exit(1);
  }

  console.log('OK');
  process.exit(0);
}
