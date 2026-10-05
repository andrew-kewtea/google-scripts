import { pageKey } from '../shared/scope.js';
import { installSync } from './syncWorker.js';

export {};

installSync();

chrome.action.onClicked.addListener((tab) => {
  void toggle(tab);
});

async function toggle(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return;
  if (!tab.url || !/^https?:/i.test(tab.url)) return;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'sidenote:toggle' });
    if (response && typeof response === 'object' && 'ok' in response && response.ok) return;
  } catch {
    // The tab has no sidenote listener yet.
  }
  try {
    await mount(tab.id);
  } catch {
    // chrome:// and the Chrome Web Store refuse injection.
  }
}

async function mount(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/location.js'],
      world: 'MAIN',
    });
  } catch {
    // The page can still report address changes through the tab URL.
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/mount.js'],
  });
}

const REOPEN = 'sidenoteReopen';
const opening = new Set<number>();
const openTabs = new Set<number>();

function openKey(tabId: number): string {
  return `sidenoteOpen:${tabId}`;
}

const ready = chrome.storage.session.get(null).then((bag) => {
  for (const [key, value] of Object.entries(bag)) {
    if (!key.startsWith('sidenoteOpen:') || value !== true) continue;
    const id = Number(key.slice('sidenoteOpen:'.length));
    if (Number.isInteger(id)) openTabs.add(id);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'sidenote:panel') {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    if (message.open === true) {
      openTabs.add(tabId);
      void chrome.storage.session.set({ [openKey(tabId)]: true });
    } else {
      openTabs.delete(tabId);
      void chrome.storage.session.remove(openKey(tabId));
    }
    sendResponse({ ok: true });
    return;
  }
  if (message.type !== 'sidenote:goto' || typeof message.url !== 'string') return;
  const tabId = sender.tab?.id;
  if (tabId === undefined || !/^https?:/i.test(message.url)) {
    sendResponse({ ok: false });
    return;
  }
  void gotoPage(tabId, message.url).then(
    () => sendResponse({ ok: true }),
    () => sendResponse({ ok: false }),
  );
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  openTabs.delete(tabId);
  void chrome.storage.session.remove(openKey(tabId));
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  void ready.then(() => {
    if (!openTabs.has(tabId)) return;
    if (typeof info.url === 'string') {
      void chrome.tabs.sendMessage(tabId, { type: 'sidenote:location' }).catch(() => undefined);
    }
    if (info.status !== 'complete' || opening.has(tabId)) return;
    opening.add(tabId);
    void settle(tabId);
  });
});

async function gotoPage(tabId: number, url: string): Promise<void> {
  openTabs.add(tabId);
  await chrome.storage.session.set({ [REOPEN]: { tabId, url } });
  await chrome.tabs.update(tabId, { url });
}

async function settle(tabId: number): Promise<void> {
  const key = openKey(tabId);
  try {
    const stored = await chrome.storage.session.get([REOPEN, key]);
    const pending = stored[REOPEN] as { tabId?: number; url?: string } | undefined;
    if (pending?.tabId === tabId && pending.url) {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || pageKey(tab.url, true) !== pageKey(pending.url, true)) return;
      await chrome.storage.session.remove(REOPEN);
      await mount(tabId);
      return;
    }
    if (stored[key] !== true) return;
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'sidenote:ping' });
      if (response && typeof response === 'object' && 'ok' in response && response.ok) return;
    } catch {
      // A full navigation replaced the document.
    }
    await mount(tabId);
  } catch {
    await chrome.storage.session.remove(REOPEN);
  } finally {
    opening.delete(tabId);
  }
}
