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

test('E2E: ST01 - CLI validation', () => {
    const output = execSync(`node ${CLI_PATH} validate`, { encoding: 'utf-8' });
    assert.match(output, /OK/);
});

test('E2E: ST02 - CLI Dry-Run (Export)', () => {
    const output = execSync(`node ${CLI_PATH} export`, { encoding: 'utf-8' });
    assert.ok(output.trim().startsWith('{') || output.trim().startsWith('['), 'Output should be JSON');
});

test('E2E: ST03 - CLI Apply (Dry Run by Default)', () => {
    const output = execSync(`node ${CLI_PATH} apply`, { encoding: 'utf-8' });
    assert.match(output, /Dry run: skipping write/);
});

test('E2E: ST04 - CLI Apply (Actual Write)', (t) => {
    const tempEngineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-e2e-'));
    t.after(() => fs.rmSync(tempEngineDir, { recursive: true, force: true }));

    const fixturePath = path.join(FIXTURES_DIR, 'snippets.sample.json');

    // Command writes actual file
    const output = execSync(`SEC_SNIPPETS=${fixturePath} node ${CLI_PATH} apply --engine espanso --yes --dir ${tempEngineDir}`, { encoding: 'utf-8' });

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
    daemonProcess.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
    });

    // Wait for daemon to be ready
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
        const portMatch = stdoutData.match(/(127\.0\.0\.1:\d+)/);
        assert.ok(portMatch, `Daemon should output listening address, got: ${stdoutData}`);

        const address = portMatch[1];

        // Fetch HTML
        const response = await fetch(`http://${address}/`);
        assert.equal(response.status, 200);

        const html = await response.text();
        assert.match(html, /window\.__SEC_TOKEN__\s*=\s*['"]/);
    } finally {
        daemonProcess.kill();
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
