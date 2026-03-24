/**
 * Cross-browser API shim: Firefox exposes `browser.*` (Promises), Chrome uses `chrome.*` (callbacks).
 * Use this module everywhere instead of calling chrome/browser directly.
 */

const root = typeof globalThis !== "undefined" ? globalThis : self;

function promisify(apiFn, thisArg) {
  return (...args) =>
    new Promise((resolve, reject) => {
      apiFn.call(thisArg, ...args, (result) => {
        const err = root.chrome?.runtime?.lastError || root.browser?.runtime?.lastError;
        if (err) {
          reject(new Error(err.message || String(err)));
          return;
        }
        resolve(result);
      });
    });
}

/** @returns {typeof chrome} */
export function getBrowser() {
  if (typeof root.browser !== "undefined" && root.browser.runtime) {
    return root.browser;
  }
  return root.chrome;
}

export const storageLocal = {
  async get(keys) {
    const b = getBrowser();
    const maybe = b.storage.local.get(keys);
    if (maybe && typeof maybe.then === "function") return maybe;
    return promisify(b.storage.local.get, b.storage.local)(keys);
  },
  async set(obj) {
    const b = getBrowser();
    const maybe = b.storage.local.set(obj);
    if (maybe && typeof maybe.then === "function") return maybe;
    return promisify(b.storage.local.set, b.storage.local)(obj);
  },
};

export const webRequest = {
  onBeforeRequest: {
    addListener(fn, filter, extra) {
      getBrowser().webRequest.onBeforeRequest.addListener(fn, filter, extra);
    },
  },
  onBeforeSendHeaders: {
    addListener(fn, filter, extra) {
      getBrowser().webRequest.onBeforeSendHeaders.addListener(fn, filter, extra);
    },
  },
  onCompleted: {
    addListener(fn, filter, extra) {
      getBrowser().webRequest.onCompleted.addListener(fn, filter, extra);
    },
  },
  onErrorOccurred: {
    addListener(fn, filter) {
      getBrowser().webRequest.onErrorOccurred.addListener(fn, filter);
    },
  },
};
