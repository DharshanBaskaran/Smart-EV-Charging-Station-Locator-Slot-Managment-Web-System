/**
 * VoltPath — API Tests
 * Basic test suite for critical endpoints.
 * Run: npx jest --verbose   OR   npm test
 */

// Use built-in Node.js test runner (no Jest dependency needed)
const { describe, it } = require('node:test');
const assert = require('node:assert');

const API_BASE = process.env.TEST_API || 'http://localhost:3001/api';

async function apiFetch(path, options = {}) {
  const url = API_BASE + path;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ok: res.ok };
}

// ── Health Check ─────────────────────────────────────────────────────────────
describe('Health Check', () => {
  it('GET /api/health should return status ok', async () => {
    const { status, data } = await apiFetch('/health');
    assert.strictEqual(status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.ok(data.uptime >= 0);
    assert.ok(data.timestamp);
  });
});

// ── Auth ─────────────────────────────────────────────────────────────────────
describe('Authentication', () => {
  let token = '';

  it('POST /api/auth/login with valid credentials should return token', async () => {
    const { status, data } = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert.strictEqual(status, 200);
    assert.ok(data.token, 'Should return a JWT token');
    assert.ok(data.user, 'Should return user data');
    token = data.token;
  });

  it('POST /api/auth/login with wrong password should return 401', async () => {
    const { status } = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrongpass' }),
    });
    assert.strictEqual(status, 401);
  });

  it('POST /api/auth/login without username should return 400', async () => {
    const { status } = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'test' }),
    });
    assert.strictEqual(status, 400);
  });

  it('GET /api/me with valid token should return user', async () => {
    assert.ok(token, 'Token should exist from login test');
    const { status, data } = await apiFetch('/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(status, 200);
    assert.ok(data.username);
  });

  it('GET /api/me without token should return 401', async () => {
    const { status } = await apiFetch('/me');
    assert.strictEqual(status, 401);
  });
});

// ── Stations ─────────────────────────────────────────────────────────────────
describe('Stations', () => {
  it('GET /api/stations should return an array', async () => {
    const { status, data } = await apiFetch('/stations');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data), 'Should return an array');
    assert.ok(data.length > 0, 'Should have at least one station');
  });

  it('GET /api/stations with geo filter should return nearby stations', async () => {
    const { status, data } = await apiFetch('/stations?lat=12.97&lng=77.59&rangeKm=10');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data));
  });

  it('GET /api/stations/:id should return station with ports', async () => {
    const listRes = await apiFetch('/stations');
    const firstStation = listRes.data[0];
    assert.ok(firstStation, 'Need at least one station');

    const { status, data } = await apiFetch(`/stations/${firstStation.stationId || firstStation.id}`);
    assert.strictEqual(status, 200);
    assert.ok(data.name);
    assert.ok(Array.isArray(data.ports));
  });
});

// ── Ports ─────────────────────────────────────────────────────────────────────
describe('Ports', () => {
  it('GET /api/ports/status should return port statuses', async () => {
    const { status, data } = await apiFetch('/ports/status');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data));
  });
});

// ── Wallet ───────────────────────────────────────────────────────────────────
describe('Wallet', () => {
  let token = '';

  it('login for wallet tests', async () => {
    const { data } = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    token = data.token;
    assert.ok(token);
  });

  it('GET /api/wallet/balance should return balance', async () => {
    const { status, data } = await apiFetch('/wallet/balance', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(status, 200);
    assert.ok(data.balance !== undefined);
    assert.strictEqual(data.currency, 'INR');
  });

  it('POST /api/wallet/topup should increase balance', async () => {
    const balBefore = (await apiFetch('/wallet/balance', { headers: { Authorization: `Bearer ${token}` } })).data.balance;

    const { status, data } = await apiFetch('/wallet/topup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: 100, paymentMethod: 'upi' }),
    });
    assert.strictEqual(status, 200);
    assert.ok(data.balance >= balBefore + 100);
  });

  it('GET /api/wallet/transactions should return array', async () => {
    const { status, data } = await apiFetch('/wallet/transactions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data.transactions));
  });
});

// ── Docs ─────────────────────────────────────────────────────────────────────
describe('API Documentation', () => {
  it('GET /api/docs/spec should return OpenAPI spec', async () => {
    const { status, data } = await apiFetch('/docs/spec');
    assert.strictEqual(status, 200);
    assert.strictEqual(data.openapi, '3.0.3');
    assert.ok(data.paths);
  });
});

console.log('\n⚡ VoltPath API Tests — run with: node --test tests/api.test.js\n');
