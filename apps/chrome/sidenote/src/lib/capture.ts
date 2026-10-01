import type { PageCapture } from './types.js';

export async function captureActiveTab(): Promise<PageCapture> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab');
  }

  const [injected] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      url: location.href,
      title: document.title,
      selection: window.getSelection()?.toString() ?? '',
    }),
  });

  const result = injected?.result;
  if (!result) {
    throw new Error('Could not read the page');
  }
  return result;
}
