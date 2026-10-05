const LOCATION_FLAG = '__sidenoteLocation';

const locationMark = window as unknown as Record<string, boolean>;
if (!locationMark[LOCATION_FLAG]) {
  locationMark[LOCATION_FLAG] = true;
  const notify = (): void => {
    window.dispatchEvent(new Event('sidenote:location'));
  };
  const wrap = (name: 'pushState' | 'replaceState'): void => {
    const original = history[name];
    history[name] = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      notify();
      return result;
    };
  };
  wrap('pushState');
  wrap('replaceState');
  window.addEventListener('popstate', notify);
  window.addEventListener('hashchange', notify);
}
