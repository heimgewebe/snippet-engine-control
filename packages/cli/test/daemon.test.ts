import test from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'http';
import { startDaemon } from '../src/daemon';

test('Daemon Security - Token and Origin validation', async (t) => {
  // Start daemon on a random port
  const port = 4001 + Math.floor(Math.random() * 1000);
  const daemon = startDaemon(port, { host: '127.0.0.1' });

  t.after(() => {
    daemon.server.close();
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
    assert.match(res.data, /"preview":"test-success"/);
  });
});
