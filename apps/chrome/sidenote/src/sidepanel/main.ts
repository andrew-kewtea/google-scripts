import { captureActiveTab } from '../lib/capture.js';
import { listNotes, saveNote } from '../lib/storage.js';
import type { LocalNote } from '../lib/types.js';

const titleEl = document.querySelector<HTMLElement>('#page-title');
const urlEl = document.querySelector<HTMLElement>('#page-url');
const bodyEl = document.querySelector<HTMLTextAreaElement>('#body');
const collectionEl = document.querySelector<HTMLInputElement>('#collection');
const statusEl = document.querySelector<HTMLElement>('#status');
const notesEl = document.querySelector<HTMLElement>('#notes');

function setStatus(message: string): void {
  if (statusEl) statusEl.textContent = message;
}

function renderNotes(notes: LocalNote[]): void {
  if (!notesEl) return;
  notesEl.replaceChildren();
  for (const note of notes) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = note.title || note.url;
    const meta = document.createElement('small');
    meta.textContent = `${note.collection} · ${note.sync}`;
    const body = document.createElement('div');
    body.textContent = note.body;
    item.append(title, meta, body);
    notesEl.append(item);
  }
}

async function showActivePage(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (titleEl) titleEl.textContent = tab?.title || 'No active tab';
  if (urlEl) urlEl.textContent = tab?.url || '';
}

document.querySelector('#capture')?.addEventListener('click', () => {
  void (async () => {
    try {
      const page = await captureActiveTab();
      if (titleEl) titleEl.textContent = page.title;
      if (urlEl) urlEl.textContent = page.url;
      if (bodyEl && page.selection) bodyEl.value = page.selection;
      setStatus(page.selection ? 'Selection captured' : 'Page captured. No selection.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Capture failed');
    }
  })();
});

document.querySelector('#save')?.addEventListener('click', () => {
  void (async () => {
    const body = bodyEl?.value.trim() ?? '';
    const url = urlEl?.textContent?.trim() ?? '';
    if (!body || !url) {
      setStatus('A page URL and a note are required.');
      return;
    }
    const note: LocalNote = {
      id: crypto.randomUUID(),
      url,
      title: titleEl?.textContent?.trim() || url,
      body,
      collection: collectionEl?.value.trim() || 'My Collections',
      createdAt: new Date().toISOString(),
      sync: 'local',
    };
    renderNotes(await saveNote(note));
    if (bodyEl) bodyEl.value = '';
    setStatus('Saved in chrome.storage.local. kchloe sync is not wired yet.');
  })();
});

void showActivePage().then(async () => {
  renderNotes(await listNotes());
});
