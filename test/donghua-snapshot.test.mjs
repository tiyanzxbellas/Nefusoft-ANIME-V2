import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath = path.join(directory, '..', 'src', 'data', 'donghuaSnapshot.json');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

test('ships a non-empty Donghua catalogue cache for upstream outages', () => {
  assert.ok(Array.isArray(snapshot.catalog));
  assert.ok(snapshot.catalog.length >= 30);
  assert.ok(Array.isArray(snapshot.updates));
  assert.ok(snapshot.updates.length > 0);
});

test('stores navigable source paths and posters for cached cards', () => {
  for (const item of snapshot.catalog) {
    assert.match(item.anichinUrl, /^https:\/\/anichin\.moe\//);
    assert.match(item.poster, /^https:\/\/anichin\.moe\//);
    assert.ok(item.title);
    assert.ok(item.slug);
  }
});
