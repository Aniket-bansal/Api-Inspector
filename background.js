/**
 * Service worker: observe web requests, merge metadata, persist last 50 API-like calls.
 */

import { getBrowser, storageLocal, webRequest } from "./utils/browser.js";
import {
  STORAGE_KEY,
  SETTINGS_KEY,
  MAX_STORED,
  MAX_PENDING,
  RESPONSE_MATCH_WINDOW_MS,
  IGNORED_URL_PREFIXES,
  ALLOWED_PROTOCOLS,
} from "./utils/config.js";
import { truncate, guessBodyType } from "./utils/text.js";
import { log, error } from "./utils/log.js";
import { DEFAULT_SETTINGS } from "./utils/settings.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * How long to keep a finalized request in `pending` waiting for its
 * `onBeforeSendHeaders` event before pushing it anyway (without headers).
 *
 * In MV3, `onCompleted` may fire before `onBeforeSendHeaders` on some platforms;
 * giving headers a short grace window avoids persisting records that are
 * missing their headers entirely.
 */
const HEADER_GRACE_MS = 2000;

/**
 * In-flight request metadata. Entries live from `onBeforeRequest` until either
 * both `onBeforeSendHeaders` and `onCompleted`/`onErrorOccurred` have arrived
 * (the common case) — or until `HEADER_GRACE_MS` after completion, whichever
 * comes first.
 *
 * @typedef {Object} PendingRecord
 * @property {string} id
 * @property {number} timestamp
 * @property {string} url
 * @property {number} tabId
 * @property {string} method
 * @property {string} resourceType
 * @property {string|null} [body]
 * @property {string|null} [bodyType]
 * @property {Array<{name:string,value:string}>} [headers]
 * @property {boolean} headersReceived
 * @property {boolean} completed
 */

/** @type {Map<string, PendingRecord>} */
const pending = new Map();

/**
 * Trim the pending map when it grows past MAX_PENDING.
 *
 * Eviction preference (so we don't lose data we already gathered):
 *  1. Records that haven't completed yet (in-flight, may never fire onCompleted)
 *  2. As a fallback, the single oldest record
 *
 * We never evict a record that's `completed && !headersReceived` (mid-grace),
 * because it's about to be persisted within HEADER_GRACE_MS.
 */
function trimPendingIfNeeded() {
  while (pending.size > MAX_PENDING) {
    let evicted = false;
    for (const id of pending.keys()) {
      const rec = pending.get(id);
      if (rec && !rec.completed) {
        pending.delete(id);
        evicted = true;
        break;
      }
    }
    if (!evicted) {
      const first = pending.keys().next().value;
      if (first === undefined) break;
      pending.delete(first);
    }
  }
}

// ---------------------------------------------------------------------------
// Types (JSDoc for editor hints)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CapturedRequest
 * @property {string} id
 * @property {number} timestamp
 * @property {string} url
 * @property {string} method
 * @property {number} tabId browser tab that issued the request (-1 if not tab-associated)
 * @property {string} resourceType webRequest ResourceType (e.g. xmlhttprequest, image)
 * @property {Array<{name: string, value: string}>} [headers]
 * @property {string|null} [body]
 * @property {string|null} [bodyType]
 * @property {{status: number, statusText: string, headers: Array<{name: string, value: string}>, body: string|null}} [response]
 */

// ---------------------------------------------------------------------------
// Capture policy: record normal page traffic (DevTools-style); skip browser internals
// ---------------------------------------------------------------------------

/**
 * @param {chrome.webRequest.WebRequestBodyDetails} details
 */
function shouldCapture(details) {
  const { url, type } = details;
  if (!url || !type) return false;

  if (IGNORED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    return false;
  }

  // http(s) and common schemes only
  try {
    if (!ALLOWED_PROTOCOLS.has(new URL(url).protocol)) return false;
  } catch {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Request body decoding
// ---------------------------------------------------------------------------

/**
 * @param {chrome.webRequest.WebRequestBody | undefined} requestBody
 * @returns {{ body: string | null, bodyType: string | null }}
 */
function decodeRequestBody(requestBody) {
  if (!requestBody) return { body: null, bodyType: null };

  if (requestBody.error) {
    return { body: null, bodyType: "error" };
  }

  if (requestBody.formData && Object.keys(requestBody.formData).length) {
    try {
      const encoded = new URLSearchParams();
      for (const [k, vals] of Object.entries(requestBody.formData)) {
        for (const v of vals) encoded.append(k, v);
      }
      const s = encoded.toString();
      return {
        body: truncate(s),
        bodyType: "application/x-www-form-urlencoded",
      };
    } catch {
      return { body: null, bodyType: "formData" };
    }
  }

  if (requestBody.raw && requestBody.raw.length) {
    try {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const chunks = requestBody.raw.map((part) => decoder.decode(part.bytes));
      const s = chunks.join("");
      return { body: truncate(s), bodyType: guessBodyType(s) };
    } catch {
      return { body: null, bodyType: "raw" };
    }
  }

  return { body: null, bodyType: null };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Persist a captured request at the front of the list, capping at MAX_STORED.
 *
 * @param {PendingRecord} rec
 */
async function pushRequest(rec) {
  try {
    const data = await storageLocal.get(STORAGE_KEY);
    /** @type {CapturedRequest[]} */
    let list = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    list.unshift({
      id: rec.id,
      timestamp: rec.timestamp,
      url: rec.url,
      tabId: rec.tabId,
      method: rec.method,
      resourceType: rec.resourceType,
      headers: rec.headers || [],
      body: rec.body ?? null,
      bodyType: rec.bodyType ?? null,
    });
    if (list.length > MAX_STORED) {
      list = list.slice(0, MAX_STORED);
    }
    await storageLocal.set({ [STORAGE_KEY]: list });
  } catch (e) {
    error("storage error", e);
  }
}

// ---------------------------------------------------------------------------
// webRequest wiring
// ---------------------------------------------------------------------------

const filter = { urls: ["<all_urls>"] };

webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!shouldCapture(details)) return;

    const { body, bodyType } = decodeRequestBody(details.requestBody);
    /** @type {PendingRecord} */
    const base = {
      id: `${details.timeStamp}-${details.requestId}`,
      timestamp: Math.round(details.timeStamp),
      url: details.url,
      tabId: details.tabId,
      method: (details.method || "GET").toUpperCase(),
      resourceType: details.type || "other",
      body,
      bodyType,
      headersReceived: false,
      completed: false,
    };
    pending.set(details.requestId, base);
    trimPendingIfNeeded();
  },
  filter,
  ["requestBody"]
);

// Note: Chrome can list Cookie / Authorization only if you add "extraHeaders" here;
// Firefox may reject unknown extraInfoSpec values, so we keep requestHeaders-only for portability.
webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const rec = pending.get(details.requestId);
    if (!rec) return;

    const headers = (details.requestHeaders || []).map((h) => ({
      name: h.name,
      value: h.value ?? "",
    }));
    rec.headers = headers;
    rec.headersReceived = true;

    // If the request already completed, finalize immediately rather than
    // waiting for the grace timer to fire.
    if (rec.completed) {
      pending.delete(details.requestId);
      void pushRequest(rec);
    }
  },
  filter,
  ["requestHeaders"]
);

/**
 * Build a finalized record from a pending entry and push it to storage.
 * Removes the pending entry.
 *
 * @param {string} requestId
 */
function finalizeAndPush(requestId) {
  const rec = pending.get(requestId);
  if (!rec) return;
  pending.delete(requestId);
  void pushRequest(rec);
}

/**
 * `onCompleted` / `onErrorOccurred` handler.
 *
 * Marks the record as completed. If headers are already present, push
 * immediately. Otherwise, give headers a short grace window (HEADER_GRACE_MS)
 * before pushing anyway — this fixes the race where `onCompleted` fires
 * before `onBeforeSendHeaders`.
 *
 * @param {chrome.webRequest.WebResponseDetails | chrome.webRequest.WebResponseErrorDetails} details
 */
function complete(details) {
  const rec = pending.get(details.requestId);
  if (!rec) return;
  rec.completed = true;

  if (rec.headersReceived) {
    pending.delete(details.requestId);
    void pushRequest(rec);
    return;
  }

  // Headers haven't arrived yet — wait briefly, then persist anyway.
  setTimeout(() => finalizeAndPush(details.requestId), HEADER_GRACE_MS);
}

webRequest.onCompleted.addListener(complete, filter);
webRequest.onErrorOccurred.addListener(complete, filter);

// ---------------------------------------------------------------------------
// Response merging: content.js hooks page fetch()/XHR (webRequest can't read
// response bodies in MV3) and reports back here; match it to the captured
// request by url + method + closest timestamp.
// ---------------------------------------------------------------------------

/**
 * @param {{url: string, method?: string, timestamp?: number, status: number, statusText?: string, headers?: Array<{name: string, value: string}>, body?: string|null}} resp
 */
async function mergeResponse(resp) {
  if (!resp || !resp.url) return;
  try {
    const data = await storageLocal.get(STORAGE_KEY);
    const list = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    const method = (resp.method || "GET").toUpperCase();

    let bestIdx = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.response || r.url !== resp.url || r.method !== method) continue;
      const diff = Math.abs((r.timestamp || 0) - (resp.timestamp || Date.now()));
      if (diff < bestDiff && diff < RESPONSE_MATCH_WINDOW_MS) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) return;

    list[bestIdx] = {
      ...list[bestIdx],
      response: {
        status: resp.status,
        statusText: resp.statusText || "",
        headers: Array.isArray(resp.headers) ? resp.headers : [],
        body: resp.body ?? null,
      },
    };
    await storageLocal.set({ [STORAGE_KEY]: list });
  } catch (e) {
    error("response merge error", e);
  }
}

getBrowser().runtime.onMessage.addListener((message) => {
  if (message?.type === "api-response") {
    void mergeResponse(message);
  }
});

// ---------------------------------------------------------------------------
// Toolbar badge: reflect the number of currently-captured requests, gated by
// the user's `showBadge` setting. Cleared on popup open (see popup.js).
// ---------------------------------------------------------------------------

/**
 * @param {number} count
 * @param {boolean} show
 */
function updateBadge(count, show) {
  try {
    const action = getBrowser().action || getBrowser().browserAction;
    if (!action) return;
    if (!show || count <= 0) {
      action.setBadgeText({ text: "" });
      return;
    }
    action.setBadgeBackgroundColor({ color: "#3b82f6" });
    action.setBadgeText({ text: count > 999 ? "999+" : String(count) });
  } catch (e) {
    // Badge is best-effort; never block capture on it.
    error("badge update failed", e);
  }
}

/**
 * Re-read storage + settings and refresh the badge. Called after each capture.
 */
async function refreshBadge() {
  try {
    const data = await storageLocal.get([STORAGE_KEY, SETTINGS_KEY]);
    const list = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
    updateBadge(list.length, settings.showBadge !== false);
  } catch (e) {
    error("badge refresh error", e);
  }
}

// Re-render the badge when either storage or settings change.
getBrowser().storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (
    Object.prototype.hasOwnProperty.call(changes, STORAGE_KEY) ||
    Object.prototype.hasOwnProperty.call(changes, SETTINGS_KEY)
  ) {
    void refreshBadge();
  }
});

refreshBadge();
log("background service worker started");
