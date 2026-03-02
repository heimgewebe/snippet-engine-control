import * as fs from 'fs';
import * as path from 'path';
import { Snippet } from '@snippet-engine-control/core';

export function readSnippets(): Snippet[] {
  // Minimal MVP loader: loads JSON fixture instead of parsing YAML.
  const fixturePath = path.resolve(process.cwd(), 'fixtures/snippets.sample.json');
  try {
    const data = fs.readFileSync(fixturePath, 'utf8');
    return JSON.parse(data) as Snippet[];
  } catch (error) {
    console.error(`Error reading fixture at ${fixturePath}:`, error);
    return [];
  }
}
