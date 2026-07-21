/**
 * Node.js `got` (v13+ — Promise-based HTTP client) generator.
 *
 * `got` is async-friendly and reads well in modern Node code. We emit ES
 * module-style code (top-level await), since the extension's own runtime is
 * module-based.
 */

import { escapeSingleQuoted } from "../text.js";
import { prepareRequest, headersToObject, hasBody, tryParseJson } from "./shared.js";

/**
 * @param {import("./shared.js").GenRequest} req
 * @param {import("./shared.js").GenOptions} [opts]
 * @returns {string}
 */
export function generateNode(req, opts) {
  req = prepareRequest(req, opts);
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);

  const headerLines = Object.entries(headerObj)
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");
  const headersBlock = Object.keys(headerObj).length > 0 ? `{\n${headerLines}\n  }` : `{}`;

  const optionsParts = [`method: ${JSON.stringify(method)}`, `headers: ${headersBlock}`];

  if (hasBody(req.body, method)) {
    const parsed = tryParseJson(req.body);
    if (parsed !== null) {
      optionsParts.push(`json: ${JSON.stringify(parsed, null, 2)}`);
    } else {
      optionsParts.push(`body: '${escapeSingleQuoted(req.body)}'`);
    }
  }

  const options = `{\n  ${optionsParts.join(",\n  ")}\n}`;

  return `import got from "got";

const response = await got(${JSON.stringify(url)}, ${options});

console.log(response.statusCode);
console.log(response.body);`;
}
