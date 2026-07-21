/**
 * Code generation: fetch(), axios, and curl snippets from captured request metadata.
 *
 * Phase 1: deleted dead wrapLongLines, fixed formatBodyLiteral, deduped helpers.
 * Phase 2: each generator accepts { redactSecrets } opt.
 * Phase 3 will split this file into utils/codegen/ (one file per target).
 */

import { escapeSingleQuoted, escapeBashSingleQuoted } from "./text.js";
import { FORBIDDEN_HEADERS, BODY_METHODS } from "./config.js";
import { maskSecretsInHeaders } from "./redact.js";

/**
 * @typedef {{ redactSecrets?: boolean }} GenOptions
 */

/**
 * Apply redaction (if requested). Does not mutate the input.
 *
 * @param {{headers?: Array<{name:string,value:string}>}} req
 * @param {GenOptions} [opts]
 */
function withRedaction(req, opts) {
  if (!opts || !opts.redactSecrets) return req;
  return { ...req, headers: maskSecretsInHeaders(req.headers) };
}

/**
 * Build a plain headers object, skipping forbidden headers.
 *
 * @param {Array<{name: string, value: string}>|undefined} headers
 * @returns {Record<string, string>}
 */
function headersToObject(headers) {
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
 * Convert a captured body string into a JS expression for `body:` (fetch).
 * - JSON: `JSON.stringify(<pretty>)`
 * - Non-JSON: single-quoted, escaped JS string literal
 * - Empty / GET / HEAD: "undefined"
 *
 * @param {string|null|undefined} body
 * @param {string} method
 * @returns {string}
 */
function bodyToFetchLiteral(body, method) {
  const hasBody = body != null && body !== "" && BODY_METHODS.has(method.toUpperCase());
  if (!hasBody) return "undefined";
  const trimmed = body.trim();
  try {
    return `JSON.stringify(${JSON.stringify(JSON.parse(trimmed), null, 2)})`;
  } catch {
    return `'${escapeSingleQuoted(body)}'`;
  }
}

/**
 * Convert a captured body string into a JS expression for `data:` (axios).
 * Axios auto-serializes objects, so JSON bodies are emitted as object literals.
 *
 * @param {string|null|undefined} body
 * @param {string} method
 * @returns {string|null}
 */
function bodyToAxiosDataLiteral(body, method) {
  const hasBody = body != null && body !== "" && BODY_METHODS.has(method.toUpperCase());
  if (!hasBody) return null;
  const trimmed = body.trim();
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return `'${escapeSingleQuoted(body)}'`;
  }
}

/**
 * @param {{ url: string, method: string, headers?: Array<{name: string, value: string}>, body?: string|null }} req
 * @param {GenOptions} [opts]
 * @returns {string}
 */
export function generateFetch(req, opts = {}) {
  req = withRedaction(req, opts);
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);

  const headerLines = Object.entries(headerObj)
    .map(([k, v]) => `    '${escapeSingleQuoted(k)}': '${escapeSingleQuoted(String(v))}',`)
    .join("\n");

  const headersBlock = Object.keys(headerObj).length > 0 ? `{\n${headerLines}\n  }` : `{}`;

  const bodyExpr = bodyToFetchLiteral(req.body, method);

  const optionsParts = [`method: '${method}'`, `headers: ${headersBlock}`];
  if (bodyExpr !== "undefined") optionsParts.push(`body: ${bodyExpr}`);
  const options = `{\n  ${optionsParts.join(",\n  ")}\n}`;

  return `const response = await fetch('${escapeSingleQuoted(url)}', ${options});

if (!response.ok) {
  throw new Error(\`HTTP \${response.status}\`);
}

const data = await response.json(); // or .text(), .blob(), etc.
console.log(data);`;
}

/**
 * @param {{ url: string, method: string, headers?: Array<{name: string, value: string}>, body?: string|null }} req
 * @param {GenOptions} [opts]
 * @returns {string}
 */
export function generateAxios(req, opts = {}) {
  req = withRedaction(req, opts);
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);

  const headerLines = Object.entries(headerObj)
    .map(([k, v]) => `    '${escapeSingleQuoted(k)}': '${escapeSingleQuoted(String(v))}',`)
    .join("\n");

  const headersBlock = Object.keys(headerObj).length > 0 ? `{\n${headerLines}\n  }` : `{}`;

  const dataExpr = bodyToAxiosDataLiteral(req.body, method);
  const dataBlock = dataExpr !== null ? `,\n  data: ${dataExpr}` : "";

  return `const { data } = await axios({
  method: '${method.toLowerCase()}',
  url: '${escapeSingleQuoted(url)}',
  headers: ${headersBlock}${dataBlock}
});

console.log(data);`;
}

/**
 * Build a curl command (bash-friendly: single-quoted args, line continuations).
 *
 * @param {{ url: string, method: string, headers?: Array<{name: string, value: string}>, body?: string|null }} req
 * @param {GenOptions} [opts]
 * @returns {string}
 */
export function generateCurl(req, opts = {}) {
  req = withRedaction(req, opts);
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);
  const hasBody = req.body != null && req.body !== "" && BODY_METHODS.has(method);

  const parts = [`curl -X ${method}`, escapeBashSingleQuoted(url)];

  const headerEntries = Object.entries(headerObj);
  headerEntries.sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  for (const [k, v] of headerEntries) {
    parts.push(`-H ${escapeBashSingleQuoted(`${k}: ${v}`)}`);
  }

  if (hasBody) {
    parts.push(`--data-raw ${escapeBashSingleQuoted(req.body)}`);
  }

  if (parts.length <= 2) {
    return `${parts[0]} ${parts[1]}`;
  }

  const head = `${parts[0]} ${parts[1]} \\`;
  const tail = parts
    .slice(2)
    .map((line, i, arr) => (i < arr.length - 1 ? `  ${line} \\` : `  ${line}`))
    .join("\n");

  return `${head}\n${tail}`;
}
