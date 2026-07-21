/**
 * HTTPie command-line generator.
 *
 * HTTPie is more concise and readable than cURL:
 *   http METHOD URL [header:value] [field=value] ...
 *
 * For JSON bodies we use the `:=` syntax (raw JSON value). For non-JSON
 * bodies we use `--raw` to pass the literal string. Bash single-quote
 * escaping is applied to all args.
 */

import { escapeBashSingleQuoted } from "../text.js";
import { prepareRequest, headersToObject, hasBody, tryParseJson } from "./shared.js";

/**
 * @param {import("./shared.js").GenRequest} req
 * @param {import("./shared.js").GenOptions} [opts]
 * @returns {string}
 */
export function generateHttpie(req, opts) {
  req = prepareRequest(req, opts);
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);

  const parts = ["http", method, escapeBashSingleQuoted(url)];

  // Headers
  const headerEntries = Object.entries(headerObj);
  headerEntries.sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  for (const [k, v] of headerEntries) {
    parts.push(escapeBashSingleQuoted(`${k}:${v}`));
  }

  // Body
  let trailingFlag = "";
  if (hasBody(req.body, method)) {
    const parsed = tryParseJson(req.body);
    if (parsed !== null && typeof parsed === "object" && parsed !== null) {
      // Emit one `key:=value` per top-level field — readable and HTTPie-idiomatic.
      /** @type {Record<string, unknown>} */ const obj = parsed;
      for (const [k, v] of Object.entries(obj)) {
        parts.push(escapeBashSingleQuoted(`${k}:=${JSON.stringify(v)}`));
      }
    } else {
      // Non-JSON or scalar JSON: use --raw
      trailingFlag = "--raw";
      parts.push(escapeBashSingleQuoted(req.body));
    }
  }

  if (parts.length <= 3) {
    return parts.slice(0, 3).join(" ");
  }

  const head = `${parts.slice(0, 3).join(" ")} \\`;
  const rest = parts.slice(3);
  const tail = rest
    .map((line, i, arr) => (i < arr.length - 1 ? `  ${line} \\` : `  ${line}`))
    .join("\n");

  // The trailing flag (e.g. --raw) goes on the very last line, before its arg.
  if (trailingFlag) {
    return `${head}\n  ${trailingFlag} \\\n${tail}`;
  }
  return `${head}\n${tail}`;
}
