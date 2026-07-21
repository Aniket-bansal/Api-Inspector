/**
 * Central configuration for Api Inspector.
 *
 * All tunable constants and feature flags live here so they can be adjusted
 * (and eventually wired up to the options page) without hunting through the
 * codebase. Importing this module is preferred over inlining magic numbers.
 */

/** Browser-extension storage key under which the captured-request array is persisted. */
export const STORAGE_KEY = "capturedRequests";

/** Storage key for user-tunable settings (Phase 5 options page). */
export const SETTINGS_KEY = "settings";

/** Maximum number of captured requests kept in storage.local. Older entries are dropped first. */
export const MAX_STORED = 50;

/** Hard character cap for any single request/response body we store. */
export const MAX_BODY_CHARS = 100_000;

/** Maximum number of in-flight ("pending") requests held in the background's memory map. */
export const MAX_PENDING = 500;

/**
 * When matching a captured response to a stored request, allow this much
 * timestamp drift (ms). 10s is plenty for normal request→response cycles
 * while avoiding mismatches on fast-polling endpoints (the old 30s window
 * could attach a response to the wrong record).
 */
export const RESPONSE_MATCH_WINDOW_MS = 10_000;

/** Console log prefix used by every module. */
export const LOG_PREFIX = "[api-inspector]";

/** Schemes we never capture (browser-internal). Extended as a Set for fast lookups. */
export const IGNORED_URL_PREFIXES = Object.freeze([
  "chrome://",
  "chrome-extension://",
  "moz-extension://",
  "edge://",
  "about:",
  "devtools://",
]);

/** Network protocols we *do* capture. */
export const ALLOWED_PROTOCOLS = Object.freeze(new Set(["http:", "https:", "ws:", "wss:"]));

/**
 * HTTP methods that may carry a request body. Used by generators to decide
 * whether to emit a `body` / `data` / `--data-raw` field.
 */
export const BODY_METHODS = Object.freeze(new Set(["POST", "PUT", "PATCH", "DELETE"]));

/**
 * Headers browsers refuse to set on `fetch`/`XMLHttpRequest`. Stripped from
 * generated snippets because they would either be ignored or throw at runtime.
 */
export const FORBIDDEN_HEADERS = Object.freeze(
  new Set([
    "content-length",
    "host",
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ])
);
