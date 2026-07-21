/**
 * Runs in the page's own JS context (injected by content.js) so it can wrap
 * the page's real window.fetch / XMLHttpRequest and see responses.
 *
 * webRequest (background.js) only sees the request side in MV3 — this fills
 * in status / response headers / response body for fetch & XHR calls.
 *
 * The page's anti-tamper code can sometimes detect wrappers; we keep the
 * surface area minimal and the wrappers behavior-preserving.
 */
(() => {
  // Note: this file is injected as a classic script and runs in the page's
  // own JS context. It cannot import ES modules, so we redeclare the few
  // constants we need locally. The background service worker uses the
  // shared utils/config.js and utils/text.js versions.
  const MAX_BODY_CHARS = 100_000;
  const MAX_SAFE_CONTENT_LENGTH = MAX_BODY_CHARS;
  const BODYLESS_METHODS = new Set(["GET", "HEAD"]);
  const SOURCE = "api-inspector-response";

  /** @param {string} s */
  function truncate(s) {
    if (typeof s !== "string") return s;
    return s.length > MAX_BODY_CHARS ? s.slice(0, MAX_BODY_CHARS) + "\n/* …truncated… */" : s;
  }

  /**
   * @param {{ url: string, method: string, timestamp: number, status: number, statusText?: string, headers?: Array<{name:string,value:string}>, body?: string|null }} detail
   */
  function report(detail) {
    window.postMessage({ source: SOURCE, ...detail }, "*");
  }

  // ---------------------------------------------------------------------------
  // fetch
  // ---------------------------------------------------------------------------

  const origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = (
        init?.method ||
        (typeof input === "object" && input?.method) ||
        "GET"
      ).toUpperCase();
      const startedAt = Date.now();

      return origFetch.call(this, input, init).then(
        (response) => {
          // Don't buffer huge responses (video streams, downloads, etc.) into memory.
          const contentLengthHeader = response.headers.get("content-length");
          const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : NaN;
          if (Number.isFinite(contentLength) && contentLength > MAX_SAFE_CONTENT_LENGTH) {
            report({
              url,
              method,
              timestamp: startedAt,
              status: response.status,
              statusText: response.statusText,
              headers: [...response.headers.entries()].map(([name, value]) => ({ name, value })),
              body: `/* body too large (${contentLength} bytes) — not captured */`,
            });
            return response;
          }

          // GET/HEAD requests cannot have a body per spec, so don't try to read one.
          // Also skip when the body is null (e.g. opaque/cross-origin responses).
          if (BODYLESS_METHODS.has(method) || response.body == null) {
            try {
              const headers = [...response.headers.entries()].map(([name, value]) => ({
                name,
                value,
              }));
              report({
                url,
                method,
                timestamp: startedAt,
                status: response.status,
                statusText: response.statusText,
                headers,
                body: null,
              });
            } catch {
              /* ignore */
            }
            return response;
          }

          response
            .clone()
            .text()
            .then((body) => {
              report({
                url,
                method,
                timestamp: startedAt,
                status: response.status,
                statusText: response.statusText,
                headers: [...response.headers.entries()].map(([name, value]) => ({ name, value })),
                body: truncate(body),
              });
            })
            .catch(() => {});
          return response;
        },
        (err) => {
          throw err;
        }
      );
    };
  }

  // ---------------------------------------------------------------------------
  // XMLHttpRequest — proper subclass that preserves static constants
  // (DONE/UNSENT/OPENED/HEADERS_RECEIVED/LOADING) and `instanceof`.
  // ---------------------------------------------------------------------------

  const OrigXHR = window.XMLHttpRequest;
  if (OrigXHR) {
    const META = Symbol("apiInspectorMeta");

    class WrappedXHR extends OrigXHR {
      constructor() {
        super();
        this[META] = null;
        this.addEventListener("loadend", () => {
          const meta = this[META];
          if (!meta) return;

          /** @type {Array<{name:string,value:string}>} */
          let headers = [];
          try {
            headers = this.getAllResponseHeaders()
              .split("\r\n")
              .filter(Boolean)
              .map((line) => {
                const idx = line.indexOf(":");
                return {
                  name: line.slice(0, idx).trim(),
                  value: line.slice(idx + 1).trim(),
                };
              });
          } catch {
            /* ignore */
          }

          let body = null;
          // GET/HEAD cannot have bodies per spec; skip the read.
          if (!BODYLESS_METHODS.has(meta.method)) {
            try {
              const text = this.responseText;
              if (typeof text === "string") body = truncate(text);
            } catch {
              /* responseText may throw on non-text responseTypes */
            }
          }

          report({
            url: meta.url,
            method: meta.method,
            timestamp: meta.startedAt,
            status: this.status,
            statusText: this.statusText,
            headers,
            body,
          });
        });
      }

      open(method, url, ...rest) {
        this[META] = {
          method: (method || "GET").toUpperCase(),
          url,
          startedAt: Date.now(),
        };
        return super.open(method, url, ...rest);
      }
    }

    // Static constants (XMLHttpRequest.DONE, .UNSENT, …) are inherited from
    // OrigXHR via the prototype chain automatically because we used `extends`.
    // Expose the class under both names some libraries look for.
    window.XMLHttpRequest = WrappedXHR;
  }
})();
