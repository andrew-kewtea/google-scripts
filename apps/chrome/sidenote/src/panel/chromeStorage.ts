import { STORAGE_KEY, AUTH_KEY, OUTBOX_KEY, type SidenoteState } from '../shared/types.js';
import type { AuthRecord } from '../lib/auth.js';
import type { OutboxEntry } from '../lib/sync.js';
import type { StoragePort } from './dataService.js';

export function chromeStoragePort(): StoragePort {
  return {
    async get() {
      const bag = await chrome.storage.local.get(STORAGE_KEY);
      const value = bag[STORAGE_KEY];
      if (!value || typeof value !== 'object') return null;
      return value as SidenoteState;
    },
    async set(state) {
      await chrome.storage.local.set({ [STORAGE_KEY]: state });
    },
  };
}

export async function loadAuth(): Promise<AuthRecord | null> {
  const bag = await chrome.storage.local.get(AUTH_KEY);
  const value = bag[AUTH_KEY];
  if (!value || typeof value !== 'object') return null;
  const row = value as AuthRecord;
  if (!row.accessToken || !row.refreshToken) return null;
  return row;
}

export async function saveAuth(auth: AuthRecord): Promise<void> {
  await chrome.storage.local.set({ [AUTH_KEY]: auth });
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove(AUTH_KEY);
}

export async function loadOutbox(): Promise<OutboxEntry[]> {
  const bag = await chrome.storage.local.get(OUTBOX_KEY);
  const value = bag[OUTBOX_KEY];
  return Array.isArray(value) ? (value as OutboxEntry[]) : [];
}

export async function saveOutbox(entries: OutboxEntry[]): Promise<void> {
  await chrome.storage.local.set({ [OUTBOX_KEY]: entries });
}

export async function loadReauth(): Promise<boolean> {
  const bag = await chrome.storage.local.get('sidenote.reauth');
  return bag['sidenote.reauth'] === true;
}

export async function setReauth(value: boolean): Promise<void> {
  if (value) await chrome.storage.local.set({ 'sidenote.reauth': true });
  else await chrome.storage.local.remove('sidenote.reauth');
}
