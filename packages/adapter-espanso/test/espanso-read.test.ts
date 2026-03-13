import * as assert from 'assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readSnippetsFromEspanso, readSnippets } from '../src/espanso/read';

test('readSnippets - reads JSON file with inputPath', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-read-snippets-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const snippetsData = [
    {
      id: 'test-1',
      triggers: [':test'],
      body: 'test body',
      origin: { source: 'universal', path: 'test.json' }
    }
  ];
  const filePath = path.join(tmpDir, 'test.json');
  fs.writeFileSync(filePath, JSON.stringify(snippetsData));

  const snippets = readSnippets(filePath);
  assert.equal(snippets.length, 1);
  assert.equal(snippets[0].id, 'test-1');
});

test('readSnippets - returns empty array when inputPath is missing', (t) => {
  const snippets = readSnippets();
  assert.deepEqual(snippets, []);
});

test('Espanso Read - golden path YAML files', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-test-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

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

  const snippetsSecondRun = readSnippetsFromEspanso(tmpDir);
  assert.equal(snippets.length, snippetsSecondRun.length);
  assert.equal(snippets[0].id, snippetsSecondRun[0].id, 'IDs should be deterministic across reads');
  assert.equal(snippets[1].id, snippetsSecondRun[1].id, 'IDs should be deterministic across reads');
});

test('Espanso Read - mixed app_exclude types are filtered', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-test-mixed-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const matchDir = path.join(tmpDir, 'match');
  fs.mkdirSync(matchDir, { recursive: true });

  const yamlContent = `
matches:
  - trigger: ":mixed"
    replace: "Mixed types"
    app_exclude: ["terminal", 123, null, "browser"]
  `;
  const filePath = path.join(matchDir, 'mixed.yml');
  fs.writeFileSync(filePath, yamlContent);

  const snippets = readSnippetsFromEspanso(tmpDir);
  assert.equal(snippets.length, 1);
  assert.deepEqual(snippets[0].constraints?.appExclude, ['terminal', 'browser']);
});

test('Espanso Read - invalid YAML throws', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-test-err-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

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
});

test('Espanso Read - empty replace string is kept', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-test-empty-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const matchDir = path.join(tmpDir, 'match');
  fs.mkdirSync(matchDir, { recursive: true });

  const yamlContent = `
matches:
  - trigger: ":empty"
    replace: ""
  `;
  const filePath = path.join(matchDir, 'empty.yml');
  fs.writeFileSync(filePath, yamlContent);

  const snippets = readSnippetsFromEspanso(tmpDir);
  assert.equal(snippets.length, 1);
  assert.equal(snippets[0].body, '');
});

test('Espanso Read - skip invalid objects silently', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-test-skip-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

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
});

test('Espanso Read - ignores snapshot files', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-espanso-test-snapshot-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const matchDir = path.join(tmpDir, 'match');
  fs.mkdirSync(matchDir, { recursive: true });

  const yamlContent = `
matches:
  - trigger: ":bad"
    replace: "Should be ignored"
  `;
  const filePath = path.join(matchDir, 'sec.generated.snapshot.12345.yml');
  fs.writeFileSync(filePath, yamlContent);

  const snippets = readSnippetsFromEspanso(tmpDir);
  assert.equal(snippets.length, 0, 'Snapshot files should not be parsed into snippets');
});
