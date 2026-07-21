/**
 * Shared helpers for all code generators.
 *
 * Generators are pure functions: `(req, opts) => string`. They never touch the
 * DOM or storage. Anything language-specific (quoting, escaping) lives in the
 * individual generator files; cross-cutting concerns (redaction, body
 * classification) live here.
 */

import { FORBIDDEN_HEADERS, BODY_METHODS } from "../config.js";
import { maskSecretsInHeaders } from "../redact.js";

/**
 * @typedef {{ redactSecrets?: boolean }} GenOptions
 * @typedef {{ url: string, method: string, headers?: Array<{name:string,value:string}>, body?: string|null }} GenRequest
 */

/**
 * Apply redaction (if requested) and return a new request object. Does not
 * mutate the input.
 *
 * @param {GenRequest} req
 * @param {GenOptions} [opts]
 * @returns {GenRequest}
 */
export function prepareRequest(req, opts) {
  if (!opts || !opts.redactSecrets) return req;
  return { ...req, headers: maskSecretsInHeaders(req.headers) };
}

/**
 * Build a plain headers object from captured header list, skipping headers the
 * browser refuses to let fetch() set.
 *
 * @param {Array<{name: string, value: string}>|undefined} headers
 * @returns {Record<string, string>}
 */
export function headersToObject(headers) {
  const out = /** @type {Record<string, string>} */ ({});
  if (!headers || !Array.isArray(headers)) return out;
  for (const h of headers) {
    if (!h || !h.name) continue;
    if (FORBIDDEN_HEADERS.has(h.name.toLowerCase())) continue;
    out[h.name] = h.value ?? "";
  }
  return out;
}

/**
 * Is there a meaningful body to emit for this request?
 *
 * @param {string|null|undefined} body
 * @param {string} method
 * @returns {boolean}
 */
export function hasBody(body, method) {
  return body != null && body !== "" && BODY_METHODS.has(method.toUpperCase());
}

/**
 * Try to parse the body as JSON; return the parsed value or null.
 *
 * @param {string} body
 * @returns {unknown|null}
 */
export function tryParseJson(body) {
  if (body == null) return null;
  try {
    return JSON.parse(body.trim());
  } catch {
    return null;
  }
}
