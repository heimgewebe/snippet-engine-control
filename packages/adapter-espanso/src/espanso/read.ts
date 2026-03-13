import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { Snippet, fingerprint } from '@snippet-engine-control/core';
import { discoverDirs } from './discover';

export function readSnippets(inputPath?: string): Snippet[] {
  if (!inputPath) {
    return [];
  }

  const fullPath = path.resolve(process.cwd(), inputPath);
  try {
    const data = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(data) as Snippet[];
  } catch (error) {
    throw new Error(`Failed to read snippets from ${fullPath}: ${(error as Error).message}`);
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

      // Explicitly exclude snapshot files from being read back into the system
      if (file.includes('.snapshot.')) {
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

        if (typeof match.replace !== 'string') {
          continue; // Need a string body (empty string is fine)
        }
        const body = match.replace;

        const constraints: NonNullable<Snippet['constraints']> = {};
        if (match.word === true) {
          constraints.wordBoundary = true;
        }
        if (Array.isArray(match.app_include)) {
          constraints.appInclude = match.app_include.filter((x: any) => typeof x === 'string');
        }
        if (Array.isArray(match.app_exclude)) {
          constraints.appExclude = match.app_exclude.filter((x: any) => typeof x === 'string');
        }

        const snippetDraft: Omit<Snippet, 'id'> = {
          triggers,
          body,
          origin: {
            source: 'espanso',
            path: filePath
          }
        };

        if (Object.keys(constraints).length > 0) {
          snippetDraft.constraints = constraints;
        }

        const id = fingerprint(snippetDraft as Snippet).substring(0, 12);

        const snippet: Snippet = {
          ...snippetDraft,
          id
        };

        allSnippets.push(snippet);
      }
    }
  }

  return allSnippets;
}
