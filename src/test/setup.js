// @ts-check
// Tests depend on Web Storage. Node 22+ exposes an experimental `localStorage`
// global that resolves to `undefined` unless `--localstorage-file` is passed,
// and Vitest's jsdom environment inherits it instead of jsdom's real Storage.
// Restore the jsdom implementation so tests match browser behaviour.

/**
 * @param {'localStorage'|'sessionStorage'} name
 * @returns {void}
 */
function restoreStorage(name) {
  const jsdomWindow = globalThis.jsdom && globalThis.jsdom.window;
  if (!jsdomWindow) return;

  const storage = jsdomWindow[name];
  if (!storage) return;

  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    get: () => storage,
  });
}

if (typeof globalThis.localStorage === 'undefined') restoreStorage('localStorage');
if (typeof globalThis.sessionStorage === 'undefined') restoreStorage('sessionStorage');
