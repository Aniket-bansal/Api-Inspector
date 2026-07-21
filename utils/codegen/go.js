/**
 * Go `net/http` generator.
 *
 * Emits a self-contained `main` function that performs the request and prints
 * the response. Uses `bytes.NewReader` for the body and the standard
 * `http.NewRequest` constructor.
 */

import { prepareRequest, headersToObject, hasBody } from "./shared.js";

/**
 * Escape a string for embedding inside a Go double-quoted string literal.
 * Go's strconv.Quote does this, but we don't have it here — use JSON encoding,
 * which is a superset for the characters we care about.
 *
 * @param {string} s
 */
function goQuote(s) {
  // JSON's string encoding matches Go's for our purposes (UTF-8, common
  // escapes). It's wrapped in double quotes already.
  return JSON.stringify(String(s));
}

/**
 * @param {import("./shared.js").GenRequest} req
 * @param {import("./shared.js").GenOptions} [opts]
 * @returns {string}
 */
export function generateGo(req, opts) {
  req = prepareRequest(req, opts);
  const method = (req.method || "GET").toUpperCase();
  const url = req.url || "";
  const headerObj = headersToObject(req.headers);

  const lines = [
    "package main",
    "",
    "import (",
    `    "fmt"`,
    hasBody(req.body, method) ? `    "bytes"` : null,
    `    "io"`,
    `    "net/http"`,
    ")",
    "",
    "func main() {",
  ];

  // Body construction
  if (hasBody(req.body, method)) {
    lines.push(`    body := []byte(${goQuote(req.body)})`);
    lines.push(
      `    req, err := http.NewRequest(${goQuote(method)}, ${goQuote(url)}, bytes.NewReader(body))`
    );
  } else {
    lines.push(`    req, err := http.NewRequest(${goQuote(method)}, ${goQuote(url)}, nil)`);
  }
  lines.push("    if err != nil {");
  lines.push("        panic(err)");
  lines.push("    }");
  lines.push("");

  // Headers
  const headerEntries = Object.entries(headerObj);
  for (const [k, v] of headerEntries) {
    lines.push(`    req.Header.Set(${goQuote(k)}, ${goQuote(v)})`);
  }
  if (headerEntries.length > 0) lines.push("");

  // Client call
  lines.push("    client := &http.Client{}");
  lines.push("    resp, err := client.Do(req)");
  lines.push("    if err != nil {");
  lines.push("        panic(err)");
  lines.push("    }");
  lines.push("    defer resp.Body.Close()");
  lines.push("");
  lines.push("    fmt.Println(resp.Status)");
  lines.push("    bodyBytes, _ := io.ReadAll(resp.Body)");
  lines.push("    fmt.Println(string(bodyBytes))");
  lines.push("}");

  return lines.filter((l) => l !== null).join("\n");
}
