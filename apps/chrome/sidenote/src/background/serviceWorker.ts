export {};

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
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/mount.js'],
    });
  } catch {
    // chrome:// and the Chrome Web Store refuse injection.
  }
}
