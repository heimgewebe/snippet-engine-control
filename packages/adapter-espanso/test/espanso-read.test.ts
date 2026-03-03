import * as assert from 'assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readSnippetsFromEspanso } from '../src/espanso/read';

test('Espanso Read - golden path YAML files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-test-'));
  const matchDir = path.join(tmpDir, 'match');
  fs.mkdirSync(matchDir, { recursive: true });

  const yamlContent = `
matches:
  - trigger: ":date"
    replace: "2023-10-27"
  - triggers: [":hello", ":hi"]
    replace: "Hello world"
    word: true
    app_exclude: ["terminal"]
  `;
  const filePath = path.join(matchDir, 'base.yml');
  fs.writeFileSync(filePath, yamlContent);

  const snippets = readSnippetsFromEspanso(tmpDir);

  assert.equal(snippets.length, 2);

  const first = snippets.find(s => s.triggers.includes(':date'));
  assert.ok(first);
  assert.equal(first.body, '2023-10-27');
  assert.equal(first.origin?.source, 'espanso');
  assert.equal(first.origin?.path, filePath);

  const second = snippets.find(s => s.triggers.includes(':hello'));
  assert.ok(second);
  assert.deepEqual(second.triggers, [':hello', ':hi']);
  assert.equal(second.body, 'Hello world');
  assert.equal(second.constraints?.wordBoundary, true);
  assert.deepEqual(second.constraints?.appExclude, ['terminal']);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Espanso Read - invalid YAML throws', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-test-err-'));
  const matchDir = path.join(tmpDir, 'match');
  fs.mkdirSync(matchDir, { recursive: true });

  const yamlContent = `
matches:
  - trigger: ":date
    replace: "2023-10-27"
  `; // Unclosed quote
  const filePath = path.join(matchDir, 'err.yml');
  fs.writeFileSync(filePath, yamlContent);

  assert.throws(() => {
    readSnippetsFromEspanso(tmpDir);
  }, /Failed to parse YAML/);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Espanso Read - skip invalid objects silently', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-test-skip-'));
  const matchDir = path.join(tmpDir, 'match');
  fs.mkdirSync(matchDir, { recursive: true });

  const yamlContent = `
matches:
  - trigger: ":good"
    replace: "Good"
  - replace: "Missing trigger"
  - trigger: ":missing_replace"
  `;
  const filePath = path.join(matchDir, 'skip.yml');
  fs.writeFileSync(filePath, yamlContent);

  const snippets = readSnippetsFromEspanso(tmpDir);

  assert.equal(snippets.length, 1);
  assert.equal(snippets[0].triggers[0], ':good');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
