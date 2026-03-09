import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { readSnippetsFromEspanso } from '../packages/adapter-espanso/dist/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLI_PATH = path.resolve(__dirname, '../packages/cli/dist/src/index.js');
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

const sampleFixturePath = path.join(FIXTURES_DIR, 'snippets.sample.json');

test('E2E: ST01 - CLI validation', () => {
    const output = execSync(`node ${CLI_PATH} validate`, {
        encoding: 'utf-8',
        env: { ...process.env, SEC_SNIPPETS: sampleFixturePath }
    });
    assert.match(output, /OK/);
});

test('E2E: ST02 - CLI Dry-Run (Export)', (t) => {
    const tempEngineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-e2e-'));
    t.after(() => fs.rmSync(tempEngineDir, { recursive: true, force: true }));

    const output = execSync(`node ${CLI_PATH} export --engine espanso --dir ${tempEngineDir}`, {
        encoding: 'utf-8',
        env: { ...process.env, SEC_SNIPPETS: sampleFixturePath }
    });
    assert.ok(output.trim().startsWith('{') || output.trim().startsWith('['), 'Output should be JSON');
});

test('E2E: ST03 - CLI Apply (Dry Run by Default)', (t) => {
    const tempEngineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-e2e-'));
    t.after(() => fs.rmSync(tempEngineDir, { recursive: true, force: true }));

    const output = execSync(`node ${CLI_PATH} apply --engine espanso --dir ${tempEngineDir}`, {
        encoding: 'utf-8',
        env: { ...process.env, SEC_SNIPPETS: sampleFixturePath }
    });
    assert.match(output, /Dry run: skipping write/);
});

test('E2E: ST04 - CLI Apply (Actual Write)', (t) => {
    const tempEngineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-e2e-'));
    t.after(() => fs.rmSync(tempEngineDir, { recursive: true, force: true }));

    // Command writes actual file
    const output = execSync(`node ${CLI_PATH} apply --engine espanso --yes --dir ${tempEngineDir}`, {
        encoding: 'utf-8',
        env: { ...process.env, SEC_SNIPPETS: sampleFixturePath }
    });

    assert.match(output, /Successfully applied snippets./);

    const generatedPath = path.join(tempEngineDir, 'match', 'sec.generated.yml');
    assert.ok(fs.existsSync(generatedPath), 'sec.generated.yml should be written to temp dir');
});

test('E2E: ST05 - Daemon Launch & Token Injection', async () => {
    // Start daemon
    const daemonProcess = spawn('node', [CLI_PATH, 'ui', '--host', '127.0.0.1'], {
        env: { ...process.env, PATH: process.env.PATH }
    });

    let stdoutData = '';

    // Wait for daemon to be ready with a robust promise instead of sleep
    const readyPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Daemon start timed out. Output: ${stdoutData}`));
        }, 5000);

        daemonProcess.stdout.on('data', (chunk) => {
            stdoutData += chunk.toString();
            // Look specifically for the URL being printed by the daemon
            const match = stdoutData.match(/running securely at (http:\/\/[^\s]+)/);
            if (match) {
                clearTimeout(timeout);
                resolve(match[1]); // Resolve with the actual bound URL
            }
        });

        daemonProcess.stderr.on('data', (chunk) => {
            stdoutData += chunk.toString();
        });

        daemonProcess.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        daemonProcess.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                clearTimeout(timeout);
                reject(new Error(`Daemon exited prematurely with code ${code}. Output: ${stdoutData}`));
            }
        });
    });

    try {
        const daemonUrl = await readyPromise;
        assert.ok(daemonUrl, `Daemon should output listening address, got: ${stdoutData}`);

        // Fetch HTML
        const response = await fetch(daemonUrl);
        assert.equal(response.status, 200);

        const html = await response.text();
        assert.match(html, /window\.__SEC_TOKEN__\s*=\s*['"]/);
    } finally {
        // Wait for process to fully exit to prevent zombies
        let killTimeout;
        const exitPromise = new Promise((resolveExit) => {
            daemonProcess.on('exit', resolveExit);
            daemonProcess.on('close', resolveExit);

            // Fallback to SIGKILL if it doesn't close within 2 seconds
            killTimeout = setTimeout(() => {
                daemonProcess.kill('SIGKILL');
                resolveExit();
            }, 2000);
        });

        daemonProcess.kill('SIGTERM');

        await exitPromise;
        clearTimeout(killTimeout);
    }
});

test('E2E: ST06 - Adapter Resilience', (t) => {
    const tempEngineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-e2e-err-'));
    t.after(() => fs.rmSync(tempEngineDir, { recursive: true, force: true }));

    const matchDir = path.join(tempEngineDir, 'match');
    fs.mkdirSync(matchDir);
    fs.writeFileSync(path.join(matchDir, 'invalid.yml'), ': invalid yaml :');

    assert.throws(() => {
        readSnippetsFromEspanso(tempEngineDir);
    }, /Failed to parse YAML in/);
});
