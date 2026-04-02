import test from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { startDaemon } from '../src/daemon';

test('Daemon Security - Token and Origin validation', async (t) => {
  // Start daemon on a random port
  const port = 4001 + Math.floor(Math.random() * 1000);
  const tempEspansoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-daemon-test-'));
  const daemon = startDaemon(port, { host: '127.0.0.1', dir: tempEspansoDir });

  t.after(() => {
    daemon.server.close();
    fs.rmSync(tempEspansoDir, { recursive: true, force: true });
  });

  // Helper to make requests
  const request = (path: string, options: http.RequestOptions, body?: string): Promise<{ statusCode: number, data: string }> => {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path,
        ...options
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode || 500, data }));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  };

  await t.test('GET / rejects unauthorized Origins', async () => {
    const res = await request('/', {
      method: 'GET',
      headers: {
        'Origin': 'http://evil.com'
      }
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.data, 'Forbidden: Invalid Origin');
  });

  await t.test('GET / allows authorized Origins and injects token', async () => {
    const res = await request('/', {
      method: 'GET',
      headers: {
        'Origin': `http://127.0.0.1:${port}`
      }
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.data, /window\.__SEC_TOKEN__ = "[a-f0-9]{64}";/);
  });

  await t.test('POST /api/preview without token gets 401', async () => {
    const res = await request('/api/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({ body: "test" }));

    assert.equal(res.statusCode, 401);
    assert.match(res.data, /Missing or invalid X-SEC-Token/);
  });

  // Use the exposed token from daemon instance
  const token = daemon.token;

  await t.test('GET / fetches HTML correctly with token', async () => {
    const htmlRes = await request('/', { method: 'GET' });
    assert.match(htmlRes.data, new RegExp(`window\\.__SEC_TOKEN__ = "${token}";`));
  });

  await t.test('POST /api/preview with valid token succeeds', async () => {
    const res = await request('/api/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SEC-Token': token
      }
    }, JSON.stringify({ body: "test-success" }));

    assert.equal(res.statusCode, 200);
    assert.match(res.data, /"text":"test-success"/);
    assert.match(res.data, /"isTemplate":false/);
  });

  await t.test('PUT /api/snippets/new-123 creates a new snippet', async () => {
    const res = await request('/api/snippets/new-123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-SEC-Token': token
      }
    }, JSON.stringify({ triggers: [':new'], body: "im new" }));

    assert.equal(res.statusCode, 200);
    assert.match(res.data, /"body":"im new"/);
  });

  await t.test('PUT /api/snippets/missing-id fails with 404', async () => {
    const res = await request('/api/snippets/missing-id', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-SEC-Token': token
      }
    }, JSON.stringify({ triggers: [':miss'], body: "miss" }));

    assert.equal(res.statusCode, 404);
  });

  await t.test('POST /api/export/dry-run builds plan with draft changes', async () => {
    // 1. Insert draft
    const draftRes = await request('/api/snippets/new-export-test', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-SEC-Token': token,
        'Origin': `http://127.0.0.1:${port}`
      }
    }, JSON.stringify({ triggers: [':drun'], body: "dry run test" }));
    assert.equal(draftRes.statusCode, 200);

    // 2. Call dry-run export
    const exportRes = await request('/api/export/dry-run', {
      method: 'POST',
      headers: {
        'X-SEC-Token': token,
        'Origin': `http://127.0.0.1:${port}`
      }
    });

    assert.equal(exportRes.statusCode, 200);

    const plan = JSON.parse(exportRes.data);
    assert.ok(plan.changes);
    assert.equal(Array.isArray(plan.changes), true);

    const hasDryRunChange = plan.changes.some((c: any) =>
      c.content && c.content.includes(':drun') && c.content.includes('dry run test')
    );
    assert.equal(hasDryRunChange, true, 'Export plan should include the new draft content');
  });

  await t.test('POST /api/export/apply applies plan to mock dir and returns success', async () => {
    // The previous test added 'new-export-test' to the workspace state, so there are changes to write

    const applyRes = await request('/api/export/apply', {
      method: 'POST',
      headers: {
        'X-SEC-Token': token,
        'Origin': `http://127.0.0.1:${port}`
      }
    });

    assert.equal(applyRes.statusCode, 200);

    const body = JSON.parse(applyRes.data);
    assert.equal(body.success, true);
    assert.equal(body.changed, true);
    assert.ok(Array.isArray(body.writtenFiles));
    assert.equal(typeof body.restarted, 'boolean');
    assert.equal(typeof body.message, 'string');

    // Verify the file was actually written to the temp dir
    const targetFile = path.join(tempEspansoDir, 'match', 'sec.generated.yml');
    assert.equal(fs.existsSync(targetFile), true, 'sec.generated.yml should exist after apply');
  });

  await t.test('POST /api/export/apply succeeds on repeated invocation', async () => {
    const applyRes = await request('/api/export/apply', {
      method: 'POST',
      headers: {
        'X-SEC-Token': token,
        'Origin': `http://127.0.0.1:${port}`
      }
    });

    assert.equal(applyRes.statusCode, 200);

    const body = JSON.parse(applyRes.data);
    assert.equal(body.success, true);
  });

  await t.test('GET with malformed percent-encoding returns 400', async () => {
    const res = await request('/foo%ZZ', { method: 'GET' });
    assert.equal(res.statusCode, 400);
    assert.equal(res.data, 'Bad Request: Invalid URL encoding');
  });

  await t.test('GET with URL-encoded path traversal returns 403', async () => {
    // %2F is a percent-encoded slash. The URL parser preserves it as-is in the
    // pathname (so ".." is not normalised away), but decodeURIComponent later
    // restores the slash, producing "/../etc/passwd". path.resolve then places
    // the resulting filePath outside uiDir, which path.relative catches with "..".
    const res = await request('/..%2Fetc%2Fpasswd', { method: 'GET' });
    assert.equal(res.statusCode, 403);
    assert.equal(res.data, 'Forbidden');
  });

  await t.test('POST /api/preview with oversized body returns 413', async () => {
    // Construct a body slightly above the 1 MB limit
    const oversizedBody = 'x'.repeat(1024 * 1024 + 1);
    const res = await request('/api/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SEC-Token': token,
        'Content-Length': String(Buffer.byteLength(oversizedBody))
      }
    }, oversizedBody);
    assert.equal(res.statusCode, 413);
    const parsed = JSON.parse(res.data);
    assert.equal(parsed.error, 'Request body too large');
  });
});
