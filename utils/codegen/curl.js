/**
 * bash cURL generator.
 */

import { escapeBashSingleQuoted } from "../text.js";
import { prepareRequest, headersToObject, hasBody } from "./shared.js";

/**
 * @param {import("./shared.js").GenRequest} req
 * @param {import("./shared.js").GenOptions} [opts]
 * @returns {string}
 */
export function generateCurl(req, opts) {
  req = prepareRequest(req, opts);
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);

  const parts = [`curl -X ${method}`, escapeBashSingleQuoted(url)];

  const headerEntries = Object.entries(headerObj);
  headerEntries.sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  for (const [k, v] of headerEntries) {
    parts.push(`-H ${escapeBashSingleQuoted(`${k}: ${v}`)}`);
  }

  if (hasBody(req.body, method)) {
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
