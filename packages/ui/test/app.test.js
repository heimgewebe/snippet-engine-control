import test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('UI Defaults - new snippets initialize with wordBoundary: true', () => {
  const appJsPath = path.join(__dirname, '../app.js');
  const appJsCode = fs.readFileSync(appJsPath, 'utf8');

  // Create a mock DOM environment just enough to parse the file without throwing ReferenceErrors
  const sandbox = {
    document: {
      getElementById: () => ({
        addEventListener: () => {},
        classList: { add: () => {}, remove: () => {} },
        setAttribute: () => {},
        appendChild: () => {}
      }),
      createElement: () => ({
        classList: { add: () => {}, remove: () => {} },
        setAttribute: () => {},
        appendChild: () => {},
        addEventListener: () => {}
      }),
      body: {
        classList: { add: () => {}, remove: () => {} }
      },
      activeElement: null,
      addEventListener: () => {}
    },
    window: {
      __SEC_TOKEN__: 'test-token',
      matchMedia: () => ({ matches: false })
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
    setTimeout: () => {},
    clearTimeout: () => {},
    console: {
      error: () => {},
      log: () => {}
    },
    Date: Date,
    Map: Map,
    Set: Set,
    RegExp: RegExp,
    Promise: Promise,
    JSON: JSON,
    alert: () => {},
    confirm: () => {}
  };

  vm.createContext(sandbox);
  vm.runInContext(appJsCode, sandbox);

  // Retrieve the extracted helper function from the sandbox
  const createDefaultSnippet = sandbox.createDefaultSnippet;

  assert.ok(typeof createDefaultSnippet === 'function', 'createDefaultSnippet should be defined in app.js');

  const snippet = createDefaultSnippet('new-test-123');

  assert.equal(snippet.id, 'new-test-123');
  assert.equal(snippet.triggers[0], ':new');
  assert.equal(snippet.constraints?.wordBoundary, true, 'New snippets MUST have constraints.wordBoundary set to true to enforce safe semantics');
});