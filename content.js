/**
 * Isolated-world content script: injects inject.js into the page's own JS
 * context (needed to see the page's real fetch/XHR calls) and relays the
 * response info it posts back to the background service worker.
 *
 * NOTE: Content scripts in MV3 cannot use static `import` (only the background
 * service worker can be `"type": "module"`). We therefore use the `chrome.*`
 * namespace directly — Firefox content scripts alias `browser.*` to `chrome.*`,
 * so the calls work cross-browser without the utils/browser.js shim.
 */
(() => {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("inject.js");
  script.addEventListener("load", () => script.remove());
  (document.head || document.documentElement).appendChild(script);

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "api-inspector-response") return;
    const { url, method, timestamp, status, statusText, headers, body } = data;
    chrome.runtime.sendMessage({
      type: "api-response",
      url,
      method,
      timestamp,
      status,
      statusText,
      headers,
      body,
    });
  });
})();
