/**
 * Pure string helpers shared across modules.
 *
 * Kept dependency-free so they can be unit-tested in isolation and reused by
 * both the background service worker and the popup.
 */

import { MAX_BODY_CHARS } from "./config.js";

/**
 * Truncate a string to MAX_BODY_CHARS, marking the cut with an ellipsis comment
 * that's valid in both JS and bash contexts.
 *
 * @param {string} s
 * @param {number} [max=MAX_BODY_CHARS]
 * @returns {string}
 */
export function truncate(s, max = MAX_BODY_CHARS) {
  if (typeof s !== "string") return s;
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n/* …truncated… */";
}

/**
 * Escape a string for use inside a single-quoted JS string literal.
 *
 * @param {string} s
 * @returns {string}
 */
export function escapeSingleQuoted(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

/**
 * Escape a string for use inside a single-quoted bash token using the standard
 * `'\''` close-reopen pattern.
 *
 * @param {string} s
 * @returns {string} The string wrapped in single quotes.
 */
export function escapeBashSingleQuoted(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/**
 * HTML-escape arbitrary text for safe insertion into `innerHTML`.
 *
 * @param {string} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * HTML-escape for use inside double-quoted attributes; also escapes the single
 * quote for robustness inside single-quoted attributes.
 *
 * @param {string} s
 * @returns {string}
 */
export function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

/**
 * Try to pretty-print a string as JSON; on failure return the original string
 * untouched (NOT a JSON-stringified version of it).
 *
 * @param {string} body
 * @returns {string}
 */
export function formatBodyLiteral(body) {
  if (body == null || body === "") return "null";
  const trimmed = body.trim();
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return body;
  }
}

/**
 * Naive body-type guesser used when the network layer didn't supply one.
 *
 * @param {string} s
 * @returns {string}
 */
export function guessBodyType(s) {
  const t = (s || "").trim();
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
