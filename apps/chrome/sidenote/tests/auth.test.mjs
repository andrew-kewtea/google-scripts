import assert from 'node:assert/strict';
import test from 'node:test';

import { googleLoginBody, loginWithPassword, requestPasswordReset, resetNotice } from '../dist/lib/auth.js';
import { apiRequest } from '../dist/lib/http.js';

test('login success stores the tokens and email', async () => {
  const calls = [];
  const auth = await loginWithPassword(async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return json({ access_token: 'access', refresh_token: 'refresh' }, 200);
  }, 'dev@kewtea.com', 'secret');
  assert.equal(auth.accessToken, 'access');
  assert.equal(auth.refreshToken, 'refresh');
  assert.equal(auth.email, 'dev@kewtea.com');
  assert.equal(calls[0].body.login_type, 'email_password');
  assert.equal(calls[0].body.email, 'dev@kewtea.com');
});

test('login failure exposes the form error and no tokens', async () => {
  await assert.rejects(
    () => loginWithPassword(async () => json({ detail: 'Email or password is incorrect.' }, 401), 'dev@kewtea.com', 'nope'),
    /Email or password is incorrect/,
  );
});

test('password reset notice includes the typed email', async () => {
  const notice = await requestPasswordReset(async () => json({ message: 'ok' }, 200), 'dev@kewtea.com');
  assert.equal(notice, resetNotice('dev@kewtea.com'));
  assert.match(notice, /dev@kewtea.com/);
});

test('a 401 refreshes once and retries the original request', async () => {
  const calls = [];
  let access = 'old';
  const result = await apiRequest(
    async (url, init) => {
      calls.push(url);
      if (url.endsWith('/auth/token')) {
        access = 'new';
        return json({ access_token: 'new', refresh_token: 'refresh' }, 200);
      }
      if (init.headers.authorization === 'Bearer old') return json({ detail: 'expired' }, 401);
      return json({ ok: true }, 200);
    },
    { accessToken: access, refreshToken: 'refresh', email: 'dev@kewtea.com', userId: '1' },
    '/notes/?has_url=1',
  );
  assert.equal(result.status, 200);
  assert.equal(result.reauth, false);
  assert.equal(result.auth.accessToken, 'new');
  assert.equal(calls.filter((url) => url.endsWith('/auth/token')).length, 1);
});

test('refresh failure clears the session and asks for login', async () => {
  const result = await apiRequest(
    async (url) => (url.endsWith('/auth/token') ? json({ detail: 'nope' }, 401) : json({}, 401)),
    { accessToken: 'old', refreshToken: 'refresh', email: 'dev@kewtea.com', userId: '1' },
    '/notes/',
  );
  assert.equal(result.reauth, true);
  assert.equal(result.auth, null);
});

test('google login posts the code and redirect uri', () => {
  assert.deepEqual(googleLoginBody('abc', 'https://extension.chromiumapp.org/'), {
    code: 'abc',
    redirect_uri: 'https://extension.chromiumapp.org/',
  });
});

function json(body, status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}
