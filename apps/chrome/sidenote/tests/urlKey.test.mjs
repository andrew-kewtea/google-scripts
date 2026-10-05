import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalUrl, patternCovers, samePage } from '../dist/shared/urlKey.js';

test('www, slash, hash, and query collapse in code', () => {
  const left = canonicalUrl('https://www.Example.com/docs/?utm_source=x&v=1#part');
  const right = canonicalUrl('https://example.com/docs');
  assert.equal(left, right);
  assert.equal(canonicalUrl('https://www.example.com/'), 'https://example.com/');
});

test('a path glob rule treats variations as one page', () => {
  const rules = [{ kind: 'path_glob', pattern: 'bbc.com/future/*' }];
  const article = 'https://www.bbc.com/future/article/one?x=1';
  const other = 'https://bbc.com/future/article/two#end';
  assert.equal(samePage(article, other, [], rules), true);
  assert.equal(samePage(article, 'https://bbc.com/news', [], rules), false);
});

test('about patterns match the current page', () => {
  assert.equal(patternCovers('example.com/docs/*', 'https://www.example.com/docs/guide?q=1'), true);
  assert.equal(patternCovers('example.com/docs/*', 'https://example.com/other'), false);
});
