import * as fs from 'fs';
import * as path from 'path';
import { Snippet } from '@snippet-engine-control/core';

export function readSnippets(inputPath?: string): Snippet[] {
  // Minimal MVP loader: loads JSON fixture instead of parsing YAML.
  const fixturePath = inputPath ? path.resolve(process.cwd(), inputPath) : path.resolve(process.cwd(), 'fixtures/snippets.sample.json');
  try {
    const data = fs.readFileSync(fixturePath, 'utf8');
    return JSON.parse(data) as Snippet[];
  } catch (error) {
    throw new Error(`Failed to read snippets from ${fixturePath}: ${(error as Error).message}`);
  }
}
