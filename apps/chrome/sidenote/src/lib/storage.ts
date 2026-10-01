import type { LocalNote } from './types.js';

const NOTES_KEY = 'sidenote.notes';

export async function listNotes(): Promise<LocalNote[]> {
  const stored = await chrome.storage.local.get(NOTES_KEY);
  const notes = stored[NOTES_KEY];
  return Array.isArray(notes) ? (notes as LocalNote[]) : [];
}

export async function saveNote(note: LocalNote): Promise<LocalNote[]> {
  const notes = await listNotes();
  const next = [note, ...notes];
  await chrome.storage.local.set({ [NOTES_KEY]: next });
  return next;
}
