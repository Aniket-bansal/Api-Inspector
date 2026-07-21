/**
 * Native JS fetch() generator.
 */

import { escapeSingleQuoted } from "../text.js";
import { prepareRequest, headersToObject, hasBody, tryParseJson } from "./shared.js";

/**
 * @param {import("./shared.js").GenRequest} req
 * @param {import("./shared.js").GenOptions} [opts]
 * @returns {string}
 */
export function generateFetch(req, opts) {
  req = prepareRequest(req, opts);
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);

  const headerLines = Object.entries(headerObj)
    .map(([k, v]) => `    '${escapeSingleQuoted(k)}': '${escapeSingleQuoted(String(v))}',`)
    .join("\n");

  const headersBlock = Object.keys(headerObj).length > 0 ? `{\n${headerLines}\n  }` : `{}`;

  let bodyExpr = "undefined";
  if (hasBody(req.body, method)) {
    const parsed = tryParseJson(req.body);
    if (parsed !== null) {
      bodyExpr = `JSON.stringify(${JSON.stringify(parsed, null, 2)})`;
    } else {
      bodyExpr = `'${escapeSingleQuoted(req.body)}'`;
    }
  }

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
