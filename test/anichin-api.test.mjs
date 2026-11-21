import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../api/anichin.js';

const asResponse = (status, body, contentType = 'text/html; charset=utf-8') => ({
  status,
  headers: new Headers({ 'content-type': contentType }),
  arrayBuffer: async () => new TextEncoder().encode(body).buffer,
});

const invoke = async (path = '/api/anichin?path=%2F') => {
  const headers = new Map();
  let payload = '';
  const req = { url: path, headers: { 'user-agent': 'Mozilla/5.0 test' } };
  const res = {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    end(value = '') {
      payload = String(value);
    },
  };
  await handler(req, res);
  return { status: res.statusCode, headers, payload };
};

test('uses the direct source response when it is healthy', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    if (url === 'https://anichin.moe/') {
      return asResponse(200, '<html><body><div class="listupd">content</div></body></html>');
    }
    return asResponse(503, 'upstream unavailable');
  };

  const response = await invoke();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-proxy-transport'), 'direct');
  assert.match(response.payload, /listupd/);
  assert.match(response.headers.get('cache-control'), /s-maxage=600/);
});

test('falls back to a server-side proxy without depending on browser CORS', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    if (url.startsWith('https://api.allorigins.win/raw?url=')) {
      return asResponse(200, '<html><body><article class="bs">proxy content</article></body></html>');
    }
    return asResponse(403, 'Access denied');
  };

  const response = await invoke('/api/anichin?path=%2Fongoing%2F');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-proxy-transport'), 'allorigins');
  assert.match(response.payload, /proxy content/);
});

test('rejects a 200 proxy limit page and uses the next valid transport', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    if (url.startsWith('https://corsproxy.io/')) {
      return asResponse(200, '<html><body><div class="entry-title">episode</div></body></html>');
    }
    return asResponse(200, '<html><body>Proxy rate limit page</body></html>');
  };

  const response = await invoke('/api/anichin?path=%2Fsome-series%2F');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-proxy-transport'), 'corsproxy');
  assert.match(response.payload, /entry-title/);
});

test('returns a structured 502 after every transport fails', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async () => asResponse(403, 'Access denied');

  const response = await invoke('/api/anichin?path=%2F&diag=1');

  assert.equal(response.status, 502);
  const payload = JSON.parse(response.payload);
  assert.equal(payload.ok, false);
  assert.ok(Array.isArray(payload.attempts));
  assert.equal(payload.attempts.length, 5);
});
