import assert from 'node:assert/strict';
import test from 'node:test';

import { API_BASE, buildDonghuaBrowseUrl, isValidAnichinHtml } from '../src/utils/anichin.js';

test('uses canonical archive URLs for page one browse and search', () => {
  assert.equal(
    buildDonghuaBrowseUrl({ page: 1, category: 'list' }),
    `${API_BASE}/`
  );
  assert.equal(
    buildDonghuaBrowseUrl({ page: 1, query: 'Battle Through The Heavens' }),
    `${API_BASE}/?s=Battle%20Through%20The%20Heavens`
  );
  assert.equal(
    buildDonghuaBrowseUrl({ page: 2, query: 'Battle Through The Heavens' }),
    `${API_BASE}/page/2/?s=Battle%20Through%20The%20Heavens`
  );
});

test('builds stable genre and status archive URLs', () => {
  assert.equal(
    buildDonghuaBrowseUrl({ page: 1, genre: 'action' }),
    `${API_BASE}/genres/action/`
  );
  assert.equal(
    buildDonghuaBrowseUrl({ page: 3, genre: 'action' }),
    `${API_BASE}/genres/action/page/3/`
  );
  assert.equal(
    buildDonghuaBrowseUrl({ page: 1, category: 'ongoing' }),
    `${API_BASE}/ongoing/`
  );
  assert.equal(
    buildDonghuaBrowseUrl({ page: 2, category: 'completed' }),
    `${API_BASE}/completed/page/2/`
  );
});

test('recognizes current article.bs markup as valid Anichin HTML', () => {
  const html = `<html><body><article class="bs"><a title="Example">Example</a></article>${' '.repeat(600)}</body></html>`;
  assert.equal(isValidAnichinHtml(html), true);
});
