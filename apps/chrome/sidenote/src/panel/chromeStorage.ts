import { STORAGE_KEY, type SidenoteState } from '../shared/types.js';
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
