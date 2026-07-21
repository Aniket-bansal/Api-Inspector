# Privacy Policy — Api Inspector

**Last updated:** 2026-07-20

Api Inspector is a browser extension that captures HTTP/HTTPS traffic from the websites you visit so you can inspect, debug, and replay API calls. Privacy was a hard design constraint from the start: **the extension never transmits your data anywhere.**

## What we collect

**Nothing.** Api Inspector does not have any analytics, telemetry, crash reporting, or remote-logging code. There is no server. The extension cannot send your data to anyone — including its author — because there is no destination to send it to.

## What gets stored locally

All captured data lives in your browser's `storage.local`, scoped to this extension. That data includes, for the **last 50 requests you have made**:

- The request URL, HTTP method, resource type, and timestamp
- Request headers (including `Authorization`, `Cookie`, and other sensitive headers)
- Request body (capped at 100,000 characters)
- For `fetch` / `XHR` calls: response status, response headers, and response body
- The browser tab id that issued the request

**This data persists across browser restarts** until either:

- More than 50 newer requests push older ones out of the rolling buffer, or
- You click **Clear** in the popup, or
- You uninstall the extension.

## Where the data stays

- `storage.local` — on disk, in your browser profile, on this computer.
- The extension's service worker (in-memory, transient) — for the brief moment between observing a request and persisting it.

The extension does **not** use `storage.sync` (which would sync to your browser account) or any network API. You can verify this yourself: the `permissions` field in `manifest.json` only requests `webRequest` and `storage`, and there is no `fetch()` / `XMLHttpRequest` call in any background, popup, or content-script file other than the page's own (which we wrap but do not initiate).

## Sensitive data and redaction

By default, the extension **masks secret headers** (`Authorization`, `Cookie`, API-key patterns, anything matching `*token*` / `*secret*`) in generated code snippets, so you can safely paste them into bug reports, chat, or tickets without leaking credentials. This behavior can be toggled in the popup.

The detail panel shows the real values by default (it is your own traffic), but a "redact on display" toggle is available via the options page.

## What other people can see

- **Website operators** see the same traffic they would see anyway — Api Inspector observes requests but does not add, remove, or modify them.
- **The page you are visiting** can detect that its `fetch` / `XMLHttpRequest` methods have been wrapped (this is a side effect of how response capture works in Manifest V3). The wrapper is read-only and never alters the request or response payload.

## Permissions

| Permission                                             | Justification                                                                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `webRequest`                                           | Observe outgoing requests to capture metadata + request bodies                                                    |
| `storage`                                              | Persist captured requests locally so the popup can show them                                                      |
| `<all_urls>`                                           | Capture traffic from any site you browse (you can scope this down via the browser's per-site permission controls) |
| Content-script injection (`http://*/*`, `https://*/*`) | Read `fetch` / `XHR` responses (MV3 `webRequest` cannot)                                                          |

## Your choices

- **Don't want a particular site captured?** Use your browser's extension permissions UI to revoke access for that site.
- **Want to wipe everything?** Click **Clear** in the popup, or uninstall the extension.
- **Want to disable response capture entirely?** Toggle it off in the options page (also disables the page-context hook).
- **Want to share a snippet?** Leave "🔒 Redact secrets" on (the default) and your credentials will be masked.

## Open source

The entire extension is open source under the MIT License. If you don't trust this policy (and you shouldn't trust any privacy policy on its own), read the code: <https://github.com/Aniket-bansal/Api-Inspector>.

## Contact

Open an issue at <https://github.com/Aniket-bansal/Api-Inspector/issues> for any privacy or security concern.
