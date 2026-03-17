import test from 'node:test';
import assert from 'node:assert/strict';
import { doctor } from '../src/doctor';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test('sec doctor', async (t) => {
  const originalExit = process.exit;
  const originalLog = console.log;

  t.afterEach(() => {
    process.exit = originalExit;
    console.log = originalLog;
  });

  await t.test('engine not supported', (t) => {
    let exitCode: number | undefined;
    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as any;

    let logs: string[] = [];
    console.log = (msg: string) => {
      logs.push(msg);
    };

    try {
      doctor({ engine: 'unknown-engine' });
    } catch (e: any) {
      if (!e.message.startsWith('process.exit')) throw e;
    }

    assert.equal(exitCode, 0);
    assert.ok(logs.some(log => log.includes('[unknown-engine] Health check not supported')));
  });

  await t.test('espanso success', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-test-doctor-'));
    fs.mkdirSync(path.join(tmpDir, 'match'));

    t.after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    let exitCode: number | undefined;
    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as any;

    let logs: string[] = [];
    console.log = (msg: string) => {
      logs.push(msg);
    };

    try {
      doctor({ engine: 'espanso', dir: tmpDir });
    } catch (e: any) {
      if (!e.message.startsWith('process.exit')) throw e;
    }

    assert.equal(exitCode, 0);
    assert.ok(logs.some(log => log.includes('[Espanso] Status: ok')));
  });

  await t.test('espanso error', (t) => {
    // A non-directory path should yield status 'error'
    const tmpFile = path.join(os.tmpdir(), 'sec-test-doctor-not-dir-' + Date.now());
    fs.writeFileSync(tmpFile, 'not a dir');

    t.after(() => {
      fs.rmSync(tmpFile, { force: true });
    });

    let exitCode: number | undefined;
    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as any;

    let logs: string[] = [];
    console.log = (msg: string) => {
      logs.push(msg);
    };

    try {
      doctor({ engine: 'espanso', dir: tmpFile });
    } catch (e: any) {
      if (!e.message.startsWith('process.exit')) {
        throw e;
      }
    }

    assert.equal(exitCode, 1);
    assert.ok(logs.some(log => log.includes('[Espanso] Status: error')));
  });

  await t.test('espanso unknown', (t) => {
    // If mocking fs is too complex due to ESM/Node limits on read-only exports,
    // we can rely on a different trick: passing an invalid string that causes an unexpected
    // error inside the adapter's path processing.
    // However, the cleanest way without heavy test framework mocking is to use the existing
    // behaviour where if `discoverDirs` throws (which we can't easily make it do without
    // process mocking) or if we just test the code branch in doctor().

    // We'll skip forcing an `unknown` from the real adapter here to keep the test simple and robust,
    // as requested in the instructions "Wenn es einfach mockbar ist ... Wenn das nicht billig geht,
    // dann lass den Zusatztest weg und ändere nur die Implementierung."
    t.skip('Skipping unknown mock as it requires complex module mocking');
  });
});
