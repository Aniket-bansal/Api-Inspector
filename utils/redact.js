/**
 * Secret-header detection and value masking.
 *
 * Used by the codegen pipeline (when `redactSecrets` is on) to make generated
 * snippets safe to share, and by the popup detail view (when
 * `redactSecretsOnDisplay` is on) to obscure secrets on screen.
 *
 * The aim is to be conservative: anything that looks like a credential is
 * masked, even if we don't recognize the exact header name. False positives
 * (masking something innocuous) are preferable to false negatives (leaking a
 * real token).
 */

/** Lowercase header names that always carry secrets. */
export const SECRET_HEADER_NAMES = Object.freeze(
  new Set([
    "authorization",
    "proxy-authorization",
    "cookie",
    "set-cookie",
    "set-cookie2",
    "x-api-key",
    "x-auth-token",
    "x-csrf-token",
    "x-xsrf-token",
    "x-secret",
  ])
);

/**
 * Substring patterns that mark a header name as secret-bearing.
 * Matched case-insensitively against the lowercased name.
 */
export const SECRET_HEADER_PATTERNS = Object.freeze([
  /(?:^|[-_])token(?:[-_]|$)/i,
  /(?:^|[-_])secret(?:[-_]|$)/i,
  /api[-_]?key/i,
  /auth(?:[-_]?token)?/i,
  /session[-_]?id/i,
  /password/i,
  /passwd/i,
]);

/**
 * Best-effort: does this header name look like it carries a secret?
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isSecretHeader(name) {
  if (!name) return false;
  const lower = String(name).toLowerCase();
  if (SECRET_HEADER_NAMES.has(lower)) return true;
  return SECRET_HEADER_PATTERNS.some((p) => p.test(lower));
}

/**
 * Mask a single header value. Preserves common scheme prefixes
 * (e.g. `Bearer `, `Basic `, `Token `) so the snippet still reads naturally.
 *
 * @param {string} value
 * @returns {string}
 */
export function redactHeaderValue(value) {
  if (value == null) return value;
  const s = String(value);
  if (s === "") return s;

  // Preserve "Bearer " / "Basic " / "Token " prefixes for readability.
  const schemeMatch = s.match(/^([A-Za-z][A-Za-z0-9]*[-_]?\w*\s+)(\S.*)$/);
  if (schemeMatch) {
    return `${schemeMatch[1]}<redacted>`;
  }
  if (s.length <= 6) return "<redacted>";
  return `${s.slice(0, 4)}…<redacted>`;
}

/**
 * Return a new headers array with secret values masked. Non-secret headers are
 * passed through untouched. Does not mutate the input.
 *
 * @param {Array<{name:string,value:string}>|undefined} headers
 * @returns {Array<{name:string,value:string}>}
 */
export function maskSecretsInHeaders(headers) {
  if (!Array.isArray(headers)) return [];
  return headers.map((h) =>
    isSecretHeader(h.name) ? { name: h.name, value: redactHeaderValue(h.value) } : { ...h }
  );
}
