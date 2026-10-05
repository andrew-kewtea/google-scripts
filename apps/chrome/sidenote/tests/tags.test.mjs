import assert from 'node:assert/strict';
import test from 'node:test';

import { suggestPath, tagChoices } from '../dist/lib/tags.js';

test('signed-in tag suggest uses the suggest query', () => {
  const path = suggestPath('mu');
  assert.match(path, /^\/tags\/suggest\?/);
  const params = new URLSearchParams(path.split('?')[1]);
  assert.equal(params.get('q'), 'mu');
  assert.equal(params.get('recent'), '5');
});

test('a new tag name is a create choice only when signed in', () => {
  const local = [{ id: '1', name: 'mail' }];
  const remote = [{ id: '9', name: 'muse' }];
  assert.deepEqual(tagChoices(local, remote, false), local);
  assert.deepEqual(tagChoices(local, remote, true).map((tag) => tag.name), ['mail', 'muse']);
});
