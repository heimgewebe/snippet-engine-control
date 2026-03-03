import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'yaml';
import { Snippet } from '@snippet-engine-control/core';
import { discoverDirs } from './discover';

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

export function readSnippetsFromEspanso(targetDir?: string): Snippet[] {
  let dirsToCheck: string[] = [];

  if (targetDir) {
    dirsToCheck.push(path.resolve(process.cwd(), targetDir));
  } else {
    dirsToCheck = discoverDirs();
  }

  const allSnippets: Snippet[] = [];

  for (const dir of dirsToCheck) {
    const matchDir = path.join(dir, 'match');
    if (!fs.existsSync(matchDir) || !fs.statSync(matchDir).isDirectory()) {
      continue;
    }

    const files = fs.readdirSync(matchDir);
    for (const file of files) {
      if (!file.endsWith('.yml') && !file.endsWith('.yaml')) {
        continue;
      }

      const filePath = path.join(matchDir, file);
      let content: string;
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (e) {
        throw new Error(`Failed to read ${filePath}: ${(e as Error).message}`);
      }

      let parsed: any;
      try {
        parsed = yaml.parse(content);
      } catch (e) {
        throw new Error(`Failed to parse YAML in ${filePath}: ${(e as Error).message}`);
      }

      if (!parsed || !parsed.matches || !Array.isArray(parsed.matches)) {
        continue;
      }

      for (const match of parsed.matches) {
        const triggers: string[] = [];
        if (typeof match.trigger === 'string') {
          triggers.push(match.trigger);
        }
        if (Array.isArray(match.triggers)) {
          triggers.push(...match.triggers.filter((t: any) => typeof t === 'string'));
        }

        if (triggers.length === 0) {
          continue; // Need at least one trigger
        }

        let body = '';
        if (typeof match.replace === 'string') {
          body = match.replace;
        }

        if (!body) {
          continue; // Need a body
        }

        const constraints: Snippet['constraints'] = {};
        if (match.word === true) {
          constraints.wordBoundary = true;
        }
        if (Array.isArray(match.app_include)) {
          constraints.appInclude = match.app_include;
        }
        if (Array.isArray(match.app_exclude)) {
          constraints.appExclude = match.app_exclude;
        }

        // Use a hash for ID if not provided, since Espanso doesn't mandate IDs in matches
        const idStr = `${filePath}:${JSON.stringify(match)}`;
        const id = crypto.createHash('sha256').update(idStr).digest('hex').substring(0, 12);

        const snippet: Snippet = {
          id,
          triggers,
          body,
          origin: {
            source: 'espanso',
            path: filePath
          }
        };

        if (Object.keys(constraints).length > 0) {
          snippet.constraints = constraints;
        }

        allSnippets.push(snippet);
      }
    }
  }

  return allSnippets;
}
