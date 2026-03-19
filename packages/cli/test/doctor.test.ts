import test from 'node:test';
import assert from 'node:assert/strict';
import { doctorInternal, DoctorDependencies } from '../src/doctor.js';

test('sec doctor', async (t) => {
  const originalLog = console.log;
  const originalError = console.error;

  t.afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
  });

  await t.test('engine not supported', (t) => {
    let logs: string[] = [];
    console.log = (msg: string) => {
      logs.push(msg);
    };

    const exitCode = doctorInternal({ engine: 'unknown-engine' });

    assert.equal(exitCode, 0);
    assert.ok(logs.some(log => log.includes('[unknown-engine] Health check not supported')));
  });

  await t.test('espanso success', (t) => {
    let logs: string[] = [];
    console.log = (msg: string) => {
      logs.push(msg);
    };

    const deps: DoctorDependencies = {
      health: () => ({ status: 'ok', message: 'Config ok' }),
      runDoctor: () => ({ status: 'ok', message: 'Runtime ok' })
    };

    const exitCode = doctorInternal({ engine: 'espanso' }, deps);

    assert.equal(exitCode, 0);
    assert.ok(logs.some(log => log.includes('[Espanso Config] Status: ok')));
    assert.ok(logs.some(log => log.includes('[Espanso Runtime] Status: ok')));
  });

  await t.test('config error', (t) => {
    let logs: string[] = [];
    console.log = (msg: string) => {
      logs.push(msg);
    };
    let errorLogs: string[] = [];
    console.error = (msg: string) => {
      errorLogs.push(msg);
    };

    let runtimeCalled = false;
    const deps: DoctorDependencies = {
      health: () => ({ status: 'error', message: 'Config missing' }),
      runDoctor: () => {
        runtimeCalled = true;
        return { status: 'ok', message: 'Runtime ok' };
      }
    };

    const exitCode = doctorInternal({ engine: 'espanso' }, deps);

    assert.equal(exitCode, 1);
    assert.ok(logs.some(log => log.includes('[Espanso Config] Status: error')));
    assert.ok(errorLogs.some(log => log.includes('[Espanso Config] Health check failed')));
    assert.equal(runtimeCalled, false);
  });

  await t.test('runtime error', (t) => {
    let logs: string[] = [];
    console.log = (msg: string) => {
      logs.push(msg);
    };
    let errorLogs: string[] = [];
    console.error = (msg: string) => {
      errorLogs.push(msg);
    };

    const deps: DoctorDependencies = {
      health: () => ({ status: 'ok', message: 'Config ok' }),
      runDoctor: () => ({ status: 'error', message: 'Runtime failed' })
    };

    const exitCode = doctorInternal({ engine: 'espanso' }, deps);

    assert.equal(exitCode, 1);
    assert.ok(logs.some(log => log.includes('[Espanso Config] Status: ok')));
    assert.ok(logs.some(log => log.includes('[Espanso Runtime] Status: error')));
    assert.ok(errorLogs.some(log => log.includes('[Espanso Runtime] Health check failed')));
  });

  await t.test('runtime degraded', (t) => {
    let logs: string[] = [];
    console.log = (msg: string) => {
      logs.push(msg);
    };
    let errorLogs: string[] = [];
    console.error = (msg: string) => {
      errorLogs.push(msg);
    };

    const deps: DoctorDependencies = {
      health: () => ({ status: 'ok', message: 'Config ok' }),
      runDoctor: () => ({ status: 'degraded', message: 'Wayland warning' })
    };

    const exitCode = doctorInternal({ engine: 'espanso' }, deps);

    // degraded should exit 0
    assert.equal(exitCode, 0);
    assert.ok(logs.some(log => log.includes('[Espanso Config] Status: ok')));
    assert.ok(logs.some(log => log.includes('[Espanso Runtime] Status: degraded')));
    assert.equal(errorLogs.length, 0);
  });
});
