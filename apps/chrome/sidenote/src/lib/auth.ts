import { apiUrl } from './api.js';

export type AuthRecord = {
  accessToken: string;
  refreshToken: string;
  email: string;
  userId: string;
  uname?: string;
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function resetNotice(email: string): string {
  return `If an account exists for ${email}, a password-reset link is on its way.`;
}

export function googleLoginBody(code: string, redirectUri: string): { code: string; redirect_uri: string } {
  return { code, redirect_uri: redirectUri };
}

export async function loginWithPassword(fetchImpl: FetchLike, email: string, password: string): Promise<AuthRecord> {
  const response = await fetchImpl(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login_type: 'email_password', email, password }),
  });
  const body = await readJson(response);
  if (!response.ok) throw new AuthError(messageOf(body, 'Email or password is incorrect.'));
  return recordFrom(body, email);
}

export async function signupWithPassword(
  fetchImpl: FetchLike,
  input: { name: string; email: string; password: string },
): Promise<{ email: string }> {
  const response = await fetchImpl(apiUrl('/auth/signup'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: input.name, email: input.email, password: input.password, verify_method: 'email_link' }),
  });
  const body = await readJson(response);
  if (!response.ok) throw new AuthError(messageOf(body, 'Could not create the account.'));
  return { email: input.email };
}

export async function requestPasswordReset(fetchImpl: FetchLike, email: string): Promise<string> {
  const response = await fetchImpl(apiUrl('/auth/request-password-reset'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok && response.status >= 500) {
    const body = await readJson(response);
    throw new AuthError(messageOf(body, 'Could not send the reset email.'));
  }
  return resetNotice(email);
}

export async function loginWithGoogleCode(fetchImpl: FetchLike, code: string, redirectUri: string): Promise<AuthRecord> {
  const response = await fetchImpl(apiUrl('/auth/google/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(googleLoginBody(code, redirectUri)),
  });
  const body = await readJson(response);
  if (!response.ok) throw new AuthError(messageOf(body, 'Google sign-in failed.'));
  return recordFrom(body, '');
}

export async function refreshAuth(fetchImpl: FetchLike, auth: AuthRecord): Promise<AuthRecord> {
  const response = await fetchImpl(apiUrl('/auth/token'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: auth.refreshToken }),
  });
  const body = await readJson(response);
  if (!response.ok) throw new AuthError(messageOf(body, 'Session expired.'));
  return recordFrom(body, auth.email, auth.userId);
}

export async function logoutAuth(fetchImpl: FetchLike, auth: AuthRecord): Promise<void> {
  await fetchImpl(apiUrl('/auth/logout'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.accessToken}` },
    body: JSON.stringify({ refresh_token: auth.refreshToken }),
  });
}

function recordFrom(body: unknown, email: string, userId = ''): AuthRecord {
  const row = asRecord(body);
  const accessToken = stringField(row, 'access_token');
  const refreshToken = stringField(row, 'refresh_token');
  if (!accessToken || !refreshToken) throw new AuthError('Sign-in did not return a session.');
  return {
    accessToken,
    refreshToken,
    email: stringField(row, 'email') || email,
    userId: stringField(row, 'user_id') || userId,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function messageOf(body: unknown, fallback: string): string {
  const row = asRecord(body);
  const detail = row.detail ?? row.message;
  return typeof detail === 'string' && detail.trim() ? detail : fallback;
}

function asRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}
