/**
 * Python `requests` generator.
 *
 * Tries to emit idiomatic Python: dict literals for headers, JSON payloads as
 * native dicts when the body parses as JSON, and triple-quoted strings
 * otherwise. Escapes triple quotes and backslashes in raw string bodies.
 */

import { prepareRequest, headersToObject, hasBody, tryParseJson } from "./shared.js";

/**
 * Escape a string for embedding inside a Python triple-quoted literal.
 *
 * @param {string} s
 */
function escapePythonTriple(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"').replace(/\r/g, "\\r");
}

/**
 * Render a parsed JSON value as a Python literal (dict / list / scalar),
 * indented by 4 spaces per level. Tuples are not used; we map JS arrays to
 * Python lists.
 *
 * @param {unknown} value
 * @param {number} indent
 * @returns {string}
 */
function pyRepr(value, indent = 0) {
  const pad = "    ".repeat(indent);
  const innerPad = "    ".repeat(indent + 1);
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "None";
  if (typeof value === "string") return JSON.stringify(value); // JSON string syntax == Python string syntax for our cases

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => `${innerPad}${pyRepr(v, indent + 1)}`);
    return `[\n${items.join(",\n")},\n${pad}]`;
  }

  if (typeof value === "object") {
    /** @type {Record<string, unknown>} */ const obj = value;
    const entries = Object.entries(obj);
    if (entries.length === 0) return "{}";
    const items = entries.map(
      ([k, v]) => `${innerPad}${JSON.stringify(k)}: ${pyRepr(v, indent + 1)}`
    );
    return `{\n${items.join(",\n")},\n${pad}}`;
  }

  return JSON.stringify(String(value));
}

/**
 * @param {import("./shared.js").GenRequest} req
 * @param {import("./shared.js").GenOptions} [opts]
 * @returns {string}
 */
export function generatePython(req, opts) {
  req = prepareRequest(req, opts);
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);

  const headerEntries = Object.entries(headerObj);
  const headersPy =
    headerEntries.length === 0
      ? "None"
      : `{\n${headerEntries.map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n")}\n}`;

  const lines = ["import requests", ""];

  // Build the call.
  const callParts = [`url=${JSON.stringify(url)}`];
  if (headerEntries.length > 0) callParts.push(`headers=${headersPy}`);

  let jsonArg = "";
  let dataArg = "";
  if (hasBody(req.body, method)) {
    const parsed = tryParseJson(req.body);
    if (parsed !== null) {
      jsonArg = pyRepr(parsed, 0);
    } else {
      dataArg = `'''${escapePythonTriple(req.body)}'''`;
    }
  }

  let call;
  if (jsonArg) {
    callParts.push(`json=${jsonArg}`);
    call = `response = requests.request(${method.toLowerCase().toUpperCase()}, ${callParts.join(", ")})`;
  } else if (dataArg) {
    callParts.push(`data=${dataArg}`);
    call = `response = requests.request(${method.toLowerCase().toUpperCase()}, ${callParts.join(", ")})`;
  } else {
    call = `response = requests.request(${JSON.stringify(method)}, ${callParts.join(", ")})`;
  }

  // For readability, break the call across lines if it's long.
  if (call.length > 80) {
    const fn = `requests.request`;
    const args = [`"${method}"`, `url=${JSON.stringify(url)}`];
    if (headerEntries.length > 0) args.push(`headers=headers`);
    if (jsonArg) args.push(`json=payload`);
    if (dataArg) args.push(`data=body`);

    if (headerEntries.length > 0) {
      lines.push(`headers = ${headersPy}`, "");
    }
    if (jsonArg) {
      lines.push(`payload = ${jsonArg}`, "");
    }
    if (dataArg) {
      lines.push(`body = ${dataArg}`, "");
    }
    lines.push(`response = ${fn}(`);
    for (const a of args) lines.push(`    ${a},`);
    lines.push(`)`);
  } else {
    lines.push(call);
  }

  lines.push("");
  lines.push("print(response.status_code)");
  lines.push("print(response.text)");
  return lines.join("\n");
}
