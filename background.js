/**
 * Service worker: observe web requests, merge metadata, persist last 50 API-like calls.
 */

import { storageLocal, webRequest } from "./utils/browser.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "capturedRequests";
const MAX_STORED = 50;
const MAX_BODY_CHARS = 100_000;

/** @type {Map<string, Partial<CapturedRequest>>} */
const pending = new Map();
const MAX_PENDING = 500;

function trimPendingIfNeeded() {
  while (pending.size > MAX_PENDING) {
    const first = pending.keys().next().value;
    if (first === undefined) break;
    pending.delete(first);
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
 * @property {string} resourceType webRequest ResourceType (e.g. xmlhttprequest, image)
 * @property {Array<{name: string, value: string}>} [headers]
 * @property {string|null} [body]
 * @property {string|null} [bodyType]
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

  if (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("moz-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("devtools://")
  ) {
    return false;
  }

  // http(s) and common schemes only
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:" && u.protocol !== "ws:" && u.protocol !== "wss:") {
      return false;
    }
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

/**
 * @param {string} s
 */
function guessBodyType(s) {
  const t = s.trim();
  if (!t) return "text/plain";
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      JSON.parse(t);
      return "application/json";
    } catch {
      return "text/plain";
    }
  }
  return "text/plain";
}

/**
 * @param {string} s
 */
function truncate(s) {
  if (s.length <= MAX_BODY_CHARS) return s;
  return s.slice(0, MAX_BODY_CHARS) + "\n/* …truncated… */";
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * @param {CapturedRequest} record
 */
async function pushRequest(record) {
  try {
    const data = await storageLocal.get(STORAGE_KEY);
    /** @type {CapturedRequest[]} */
    let list = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    list.unshift(record);
    if (list.length > MAX_STORED) {
      list = list.slice(0, MAX_STORED);
    }
    await storageLocal.set({ [STORAGE_KEY]: list });
  } catch (e) {
    console.error("[api-reverse-engineer] storage error", e);
  }
}

/**
 * @param {string} requestId
 * @returns {CapturedRequest | null}
 */
function finalizePending(requestId) {
  const rec = pending.get(requestId);
  pending.delete(requestId);
  if (!rec || !rec.url) return null;

  return {
    id: rec.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: rec.timestamp || Date.now(),
    url: rec.url,
    method: (rec.method || "GET").toUpperCase(),
    resourceType: rec.resourceType || "other",
    headers: rec.headers || [],
    body: rec.body ?? null,
    bodyType: rec.bodyType ?? null,
  };
}

// ---------------------------------------------------------------------------
// webRequest wiring
// ---------------------------------------------------------------------------

const filter = { urls: ["<all_urls>"] };

webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!shouldCapture(details)) return;

    const { body, bodyType } = decodeRequestBody(details.requestBody);
    /** @type {Partial<CapturedRequest>} */
    const base = {
      id: `${details.timeStamp}-${details.requestId}`,
      timestamp: Math.round(details.timeStamp),
      url: details.url,
      method: details.method,
      resourceType: details.type,
      body,
      bodyType,
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
    const existing = pending.get(details.requestId);
    if (!existing) return;

    const headers = (details.requestHeaders || []).map((h) => ({
      name: h.name,
      value: h.value ?? "",
    }));
    existing.headers = headers;
  },
  filter,
  ["requestHeaders"]
);

function complete(details) {
  if (!pending.has(details.requestId)) return;
  const finalized = finalizePending(details.requestId);
  if (finalized) {
    void pushRequest(finalized);
  }
}

webRequest.onCompleted.addListener(complete, filter);
webRequest.onErrorOccurred.addListener(complete, filter);

console.log("[api-reverse-engineer] background service worker started");
