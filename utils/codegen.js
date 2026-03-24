/**
 * Code generation: fetch(), axios, and curl snippets from captured request metadata.
 */

const MAX_LINE = 100;

/**
 * Escape a string for use inside single-quoted JS string literals.
 * @param {string} s
 */
function escapeSingleQuoted(s) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
}

/**
 * Wrap a string for use inside bash/sh single quotes ('...').
 * @param {string} s
 */
function escapeBashSingleQuoted(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/**
 * Pretty-format JSON if parseable; otherwise return raw string.
 * @param {string} body
 */
function formatBodyLiteral(body) {
  if (body == null || body === "") {
    return "null";
  }
  const trimmed = body.trim();
  try {
    const parsed = JSON.parse(trimmed);
    const pretty = JSON.stringify(parsed, null, 2);
    return pretty;
  } catch {
    return JSON.stringify(body);
  }
}

/**
 * Build a plain headers object from captured header list (skips forbidden headers for fetch where noted).
 * @param {Array<{name: string, value: string}>|undefined} headers
 */
function headersToObject(headers) {
  const out = {};
  if (!headers || !Array.isArray(headers)) return out;
  const forbidden = new Set([
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
  ]);
  for (const h of headers) {
    if (!h || !h.name) continue;
    const name = h.name.toLowerCase();
    if (forbidden.has(name)) continue;
    out[h.name] = h.value ?? "";
  }
  return out;
}

/**
 * Split long lines for readability in generated code.
 * @param {string} code
 */
function wrapLongLines(code) {
  const lines = code.split("\n");
  return lines
    .map((line) => {
      if (line.length <= MAX_LINE) return line;
      return line;
    })
    .join("\n");
}

/**
 * @param {{ url: string, method: string, headers?: Array<{name: string, value: string}>, body?: string|null, bodyType?: string|null }} req
 * @returns {string}
 */
export function generateFetch(req) {
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);
  const hasBody = req.body != null && req.body !== "" && ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const headerLines = Object.entries(headerObj)
    .map(([k, v]) => `    '${escapeSingleQuoted(k)}': '${escapeSingleQuoted(String(v))}',`)
    .join("\n");

  const headersBlock =
    Object.keys(headerObj).length > 0
      ? `{\n${headerLines}\n  }`
      : `{}`;

  let bodyExpr = "undefined";
  if (hasBody) {
    const pretty = formatBodyLiteral(req.body);
    if (pretty.startsWith("{") || pretty.startsWith("[")) {
      bodyExpr = `JSON.stringify(${pretty})`;
    } else {
      bodyExpr = pretty;
    }
  }

  const optionsParts = [`method: '${method}'`, `headers: ${headersBlock}`];
  if (hasBody) {
    optionsParts.push(`body: ${bodyExpr}`);
  }
  const options = `{\n  ${optionsParts.join(",\n  ")}\n}`;

  const code = `const response = await fetch('${escapeSingleQuoted(url)}', ${options});

if (!response.ok) {
  throw new Error(\`HTTP \${response.status}\`);
}

const data = await response.json(); // or .text(), .blob(), etc.
console.log(data);
`;

  return wrapLongLines(code.trim());
}

/**
 * @param {{ url: string, method: string, headers?: Array<{name: string, value: string}>, body?: string|null }} req
 * @returns {string}
 */
export function generateAxios(req) {
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);
  const hasBody = req.body != null && req.body !== "" && ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const headerLines = Object.entries(headerObj)
    .map(([k, v]) => `    '${escapeSingleQuoted(k)}': '${escapeSingleQuoted(String(v))}',`)
    .join("\n");

  const headersBlock =
    Object.keys(headerObj).length > 0
      ? `{\n${headerLines}\n  }`
      : `{}`;

  let dataBlock = "";
  if (hasBody) {
    const pretty = formatBodyLiteral(req.body);
    if (pretty.startsWith("{") || pretty.startsWith("[")) {
      dataBlock = `,\n  data: ${pretty}`;
    } else {
      dataBlock = `,\n  data: ${pretty}`;
    }
  }

  const code = `const { data } = await axios({
  method: '${method.toLowerCase()}',
  url: '${escapeSingleQuoted(url)}',
  headers: ${headersBlock}${dataBlock}
});

console.log(data);
`;

  return wrapLongLines(code.trim());
}

/**
 * Build a curl command (bash-friendly: single-quoted args, line continuations).
 * Uses --data-raw so values starting with @ are not treated as file paths.
 *
 * @param {{ url: string, method: string, headers?: Array<{name: string, value: string}>, body?: string|null }} req
 * @returns {string}
 */
export function generateCurl(req) {
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);
  const hasBody = req.body != null && req.body !== "" && ["POST", "PUT", "PATCH", "DELETE"].includes(method);

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

  return wrapLongLines(`${head}\n${tail}`);
}
