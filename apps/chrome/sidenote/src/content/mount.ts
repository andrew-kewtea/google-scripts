const HOST_ID = 'sidenote-host';
const FLAG = '__sidenoteMounted';

const SIDE_SHADE = 28;
const COLUMN_WIDTH = 360 + SIDE_SHADE;
const SLIDE = 'transform 340ms cubic-bezier(.2, .8, .2, 1)';
const SLIDE_WIDTH = 'width 340ms cubic-bezier(.2, .8, .2, 1)';
const CLOSED = 'translate3d(calc(100% + 60px), 0, 0)';
const OPEN_TRANSFORM = 'translate3d(0, 0, 0)';

function hostEl(): HTMLElement | null {
  return document.getElementById(HOST_ID);
}

function postPage(frame: HTMLIFrameElement): void {
  frame.contentWindow?.postMessage(
    { type: 'sidenote:page', url: location.href, title: document.title },
    '*',
  );
}

function paint(el: HTMLElement, style: Record<string, string>): void {
  for (const [key, value] of Object.entries(style)) {
    el.style.setProperty(key, value, 'important');
  }
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hostChrome(width: string): Record<string, string> {
  return {
    position: 'fixed',
    top: '0',
    right: '0',
    height: '100vh',
    'z-index': '2147483646',
    width,
    transform: CLOSED,
    transition: reducedMotion() ? 'none' : SLIDE,
    'will-change': 'transform',
    contain: 'layout paint',
    'pointer-events': 'none',
    overflow: 'hidden',
    background: 'transparent',
  };
}

function frameChrome(open: boolean): Record<string, string> {
  return {
    position: 'absolute',
    top: '0',
    right: '0',
    display: 'block',
    width: `calc(100% - ${SIDE_SHADE}px)`,
    height: '100%',
    border: '0',
    background: 'transparent',
    'pointer-events': open ? 'auto' : 'none',
  };
}

let owned: HTMLIFrameElement | null = null;

function ensure(): HTMLIFrameElement {
  if (owned && owned.isConnected) return owned;
  // A host left behind by the previous extension load cannot call chrome.storage.
  hostEl()?.remove();
  const host = document.createElement('div');
  host.id = HOST_ID;
  paint(host, hostChrome(`${COLUMN_WIDTH}px`));
  const shade = document.createElement('div');
  paint(shade, {
    position: 'absolute',
    top: '0',
    bottom: '0',
    left: '0',
    width: `${SIDE_SHADE}px`,
    'pointer-events': 'none',
    background: 'linear-gradient(to left, rgba(30,28,24,.22), rgba(30,28,24,0))',
  });
  const frame = document.createElement('iframe');
  frame.title = 'sidenote';
  paint(frame, frameChrome(false));
  frame.src = chrome.runtime.getURL('panel/index.html');
  frame.addEventListener('load', () => postPage(frame));
  host.append(shade, frame);
  document.documentElement.append(host);
  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data as { type?: string; width?: number } | null;
    if (!data) return;
    if (data.type === 'sidenote:layout' && typeof data.width === 'number' && host.dataset.open === '1') {
      const next = `${data.width}px`;
      if (host.style.width !== next) {
        if (!reducedMotion()) {
          host.style.setProperty('transition', `${SLIDE}, ${SLIDE_WIDTH}`, 'important');
          void host.offsetWidth;
        }
        host.style.setProperty('width', next, 'important');
      }
    }
    if (data.type === 'sidenote:close') setOpen(false);
  });
  owned = frame;
  return frame;
}

function slide(host: HTMLElement, open: boolean): void {
  const end = open ? OPEN_TRANSFORM : CLOSED;
  if (reducedMotion()) {
    host.style.setProperty('transition', 'none', 'important');
    host.style.setProperty('transform', end, 'important');
    return;
  }
  if (open) {
    host.style.setProperty('transition', 'none', 'important');
    host.style.setProperty('transform', CLOSED, 'important');
    void host.offsetWidth;
  }
  host.style.setProperty('transition', SLIDE, 'important');
  host.style.setProperty('transform', end, 'important');
}

function setOpen(open: boolean): void {
  const host = hostEl();
  if (!host) return;
  const frame = host.querySelector('iframe');
  if (open) {
    host.style.setProperty('transition', 'none', 'important');
    host.style.setProperty('width', `${COLUMN_WIDTH}px`, 'important');
    if (frame instanceof HTMLIFrameElement) {
      frame.contentWindow?.postMessage({ type: 'sidenote:show' }, '*');
    }
  }
  slide(host, open);
  host.dataset.open = open ? '1' : '0';
  if (frame instanceof HTMLIFrameElement) {
    paint(frame, frameChrome(open));
    if (open) postPage(frame);
  }
}

function boot(): void {
  ensure();
  setOpen(true);
}

function toggle(): void {
  const host = hostEl();
  if (!host) {
    boot();
    return;
  }
  setOpen(host.dataset.open !== '1');
}

const mark = window as unknown as Record<string, boolean>;
if (!mark[FLAG]) {
  mark[FLAG] = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'sidenote:toggle') return;
    toggle();
    sendResponse({ ok: true });
  });
  boot();
} else {
  toggle();
}
