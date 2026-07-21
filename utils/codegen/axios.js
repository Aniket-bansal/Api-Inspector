/**
 * Axios generator. Emits object-literal `data:` for JSON bodies (axios
 * auto-serializes), or a single-quoted string literal otherwise.
 */

import { escapeSingleQuoted } from "../text.js";
import { prepareRequest, headersToObject, hasBody, tryParseJson } from "./shared.js";

/**
 * @param {import("./shared.js").GenRequest} req
 * @param {import("./shared.js").GenOptions} [opts]
 * @returns {string}
 */
export function generateAxios(req, opts) {
  req = prepareRequest(req, opts);
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);

  const headerLines = Object.entries(headerObj)
    .map(([k, v]) => `    '${escapeSingleQuoted(k)}': '${escapeSingleQuoted(String(v))}',`)
    .join("\n");

  const headersBlock = Object.keys(headerObj).length > 0 ? `{\n${headerLines}\n  }` : `{}`;

  let dataBlock = "";
  if (hasBody(req.body, method)) {
    const parsed = tryParseJson(req.body);
    const dataExpr =
      parsed !== null ? JSON.stringify(parsed, null, 2) : `'${escapeSingleQuoted(req.body)}'`;
    dataBlock = `,\n  data: ${dataExpr}`;
  }

  return `const { data } = await axios({
  method: '${method.toLowerCase()}',
  url: '${escapeSingleQuoted(url)}',
  headers: ${headersBlock}${dataBlock}
});

console.log(data);`;
}
