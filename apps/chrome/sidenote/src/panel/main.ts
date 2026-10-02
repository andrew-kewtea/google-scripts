import { STORAGE_KEY, type SidenoteState } from '../shared/types.js';
import { chromeStoragePort } from './chromeStorage.js';
import { startPanel } from './controller.js';
import { createDataService } from './dataService.js';

const service = createDataService(chromeStoragePort());
const loaded = await service.load();
const initial = loaded.ui.expanded ? await service.setUi(loaded, { expanded: false }) : loaded;
const panel = startPanel(service, initial);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const change = changes[STORAGE_KEY];
  if (!change?.newValue) return;
  panel.replace(change.newValue as SidenoteState);
});
