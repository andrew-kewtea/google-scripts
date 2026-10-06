import { STORAGE_KEY, type SidenoteState } from '../shared/types.js';
import { appendOutbox, planMutation } from '../lib/sync.js';
import { chromeStoragePort, loadAuth, loadOutbox, loadReauth, saveOutbox } from './chromeStorage.js';
import { startPanel } from './controller.js';
import { createDataService } from './dataService.js';

const service = createDataService(chromeStoragePort(), {
  async pinnedIds() {
    return (await loadOutbox()).map((item) => item.localId);
  },
  onCommitted(before, after) {
    const planned = planMutation(before, after);
    if (!planned.length) return;
    void loadOutbox().then((current) => saveOutbox(appendOutbox(current, planned))).then(() => {
      try {
        chrome.runtime.sendMessage({ type: 'sidenote:sync', reason: 'push' });
      } catch {
        // The alarm retries the outbox.
      }
    });
  },
});
const loaded = await service.load();
const initial = loaded.ui.expanded ? await service.setUi(loaded, { expanded: false }) : loaded;
const auth = await loadAuth();
const panel = startPanel(service, initial, auth, await loadReauth());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const change = changes[STORAGE_KEY];
  if (change?.newValue) panel.replace(change.newValue as SidenoteState);
});
