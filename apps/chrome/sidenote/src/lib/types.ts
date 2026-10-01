export type SyncState = 'local' | 'pending';

export type LocalNote = {
  id: string;
  url: string;
  title: string;
  body: string;
  collection: string;
  createdAt: string;
  sync: SyncState;
};

export type PageCapture = {
  url: string;
  title: string;
  selection: string;
};
