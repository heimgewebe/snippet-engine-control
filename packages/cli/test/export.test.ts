import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test('sec export --engine espanso with valid inputPath', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-export-test-'));

  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const matchDir = path.join(tempDir, 'match');
  fs.mkdirSync(matchDir);

  const destYaml = `
matches:
  - trigger: ";wrong"
    replace: "wrong output"
`;
  fs.writeFileSync(path.join(matchDir, 'base.yml'), destYaml, 'utf8');

  const sourceJson = `
[
  {
    "id": "snippet1",
    "triggers": [";right"],
    "body": "right output",
    "origin": { "source": "universal", "path": "test.json" }
  }
]
`;
  const inputPath = path.join(tempDir, 'source.json');
  fs.writeFileSync(inputPath, sourceJson, 'utf8');

  const cliPath = path.resolve(__dirname, '../src/index.js');

  // It prints the JSON string of ExportPlan
  const output = execSync(`node ${cliPath} export --engine espanso --dir ${tempDir} --input ${inputPath}`).toString();

  const plan = JSON.parse(output);

  assert.equal(Array.isArray(plan.changes), true);
  assert.equal(plan.changes.length, 1);

  const change = plan.changes[0];
  assert.equal(change.action, 'create');
  assert.equal(change.file, path.join(matchDir, 'sec.generated.yml'));
  assert.equal(typeof change.content, 'string');
  assert.equal(change.content.includes(';right'), true);
  assert.equal(change.content.includes(';wrong'), false);
  assert.equal(typeof change.afterHash, 'string');
});

test('sec apply --engine espanso blocks on unsupported features', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-export-test-'));

  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const sourceJson = `
[
  {
    "id": "snippet2",
    "triggers": [";tags"],
    "body": "tags output",
    "tags": ["some-tag"],
    "origin": { "source": "universal", "path": "test.json" }
  }
]
`;
  const inputPath = path.join(tempDir, 'source.json');
  fs.writeFileSync(inputPath, sourceJson, 'utf8');

  const cliPath = path.resolve(__dirname, '../src/index.js');

  let failed = false;
  try {
    execSync(`node ${cliPath} apply --engine espanso --dir ${tempDir} --input ${inputPath}`, { stdio: 'pipe' });
  } catch (error: any) {
    failed = true;
    assert.equal(error.status, 1);
    const stderr = error.stderr.toString();
    assert.equal(stderr.includes('Cannot apply plan with unsupported features'), true);
  }

  assert.equal(failed, true);
});

test('sec apply --engine espanso --yes writes only to sec.generated.yml', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-export-test-'));

  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const matchDir = path.join(tempDir, 'match');
  fs.mkdirSync(matchDir);

  const unmanagedYaml = `
matches:
  - trigger: ";keep"
    replace: "keep me"
`;
  fs.writeFileSync(path.join(matchDir, 'unmanaged.yml'), unmanagedYaml, 'utf8');

  const sourceJson = `
[
  {
    "id": "snippet3",
    "triggers": [";apply"],
    "body": "apply me",
    "origin": { "source": "universal", "path": "test.json" }
  }
]
`;
  const inputPath = path.join(tempDir, 'source.json');
  fs.writeFileSync(inputPath, sourceJson, 'utf8');

  const cliPath = path.resolve(__dirname, '../src/index.js');

  execSync(`node ${cliPath} apply --engine espanso --dir ${tempDir} --input ${inputPath} --yes`);

  const managedContent = fs.readFileSync(path.join(matchDir, 'sec.generated.yml'), 'utf8');
  assert.equal(managedContent.includes(';apply'), true);

  const unmanagedContent = fs.readFileSync(path.join(matchDir, 'unmanaged.yml'), 'utf8');
  assert.equal(unmanagedContent, unmanagedYaml); // verify unmanaged was untouched
});


test('sec apply without --yes is a dry-run and writes nothing', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-export-test-'));

  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const matchDir = path.join(tempDir, 'match');
  fs.mkdirSync(matchDir);

  const sourceJson = `
[
  {
    "id": "snippet4",
    "triggers": [";dry"],
    "body": "dry run",
    "origin": { "source": "universal", "path": "test.json" }
  }
]
`;
  const inputPath = path.join(tempDir, 'source.json');
  fs.writeFileSync(inputPath, sourceJson, 'utf8');

  const cliPath = path.resolve(__dirname, '../src/index.js');

  execSync(`node ${cliPath} apply --engine espanso --dir ${tempDir} --input ${inputPath}`);

  assert.equal(fs.existsSync(path.join(matchDir, 'sec.generated.yml')), false);
});

test('sec apply --yes creates match/ directory if it is missing', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-export-test-'));

  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Specifically DO NOT create the matchDir here
  const matchDir = path.join(tempDir, 'match');

  const sourceJson = `
[
  {
    "id": "snippet5",
    "triggers": [";mkdir"],
    "body": "created match dir",
    "origin": { "source": "universal", "path": "test.json" }
  }
]
`;
  const inputPath = path.join(tempDir, 'source.json');
  fs.writeFileSync(inputPath, sourceJson, 'utf8');

  const cliPath = path.resolve(__dirname, '../src/index.js');

  execSync(`node ${cliPath} apply --engine espanso --dir ${tempDir} --input ${inputPath} --yes`);

  assert.equal(fs.existsSync(matchDir), true);

  const managedContent = fs.readFileSync(path.join(matchDir, 'sec.generated.yml'), 'utf8');
  assert.equal(managedContent.includes(';mkdir'), true);
});
