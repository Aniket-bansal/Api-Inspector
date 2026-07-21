# Store Listing — Api Inspector

Copy from this file when submitting to the Chrome Web Store and Mozilla Add-ons (AMO). Keep the two listings in sync.

## Short name

Api Inspector

## Summary (single sentence, ≤ 132 chars)

Capture API requests from any website and instantly generate `fetch`, `axios`, `cURL`, Python, Go, Node, and HTTPie snippets.

## Description

Api Inspector is a cross-browser DevTools-style network monitor that lives in your toolbar and turns the requests a website makes into ready-to-paste code — in **seven** languages.

### What it does

- **Captures** HTTP / HTTPS traffic in the background, including request headers, request bodies, and (for `fetch` and `XHR`) the matching response.
- **Filters** DevTools-style: by resource type (Fetch/XHR, Doc, JS, CSS, …) and by response status (2xx / 3xx / 4xx / 5xx / no response).
- **Searches** by URL or HTTP method, scoped to the active tab by default with an "All tabs" toggle.
- **Generates** code in seven languages from any captured request:
  - `fetch()` (native JavaScript)
  - `axios` (JavaScript HTTP client)
  - `cURL` (bash)
  - Python (`requests`)
  - Go (`net/http`)
  - Node.js (`got`)
  - HTTPie
- **Protects your secrets**: by default, `Authorization`, `Cookie`, and similar headers are masked in generated code so snippets are safe to share. Toggle it off in one click when you need the real values.
- **Lives entirely on your machine** — no analytics, no telemetry, no remote server. See the [privacy policy](https://github.com/Aniket-bansal/Api-Inspector/blob/main/PRIVACY.md).

### Who it's for

- **Backend / API developers** reverse-engineering how a website talks to its backend
- **QA engineers** building reproduction cases from observed traffic
- **Students and learners** seeing real `fetch` / `axios` / `cURL` for the sites they use
- **Anyone who's ever squinted at the browser Network tab and then re-typed a request by hand**

### How to use

1. Browse any website. The extension silently records up to 50 of the most recent API calls.
2. Click the toolbar icon to open the popup.
3. Filter, search, or just click a request to see its full details.
4. Pick a language from the dropdown and click **Generate**.
5. Click **Copy** to copy the snippet, then paste it into your code, terminal, or chat.

### Keyboard shortcuts (popup)

- `/` — focus the search box
- `↑` / `↓` — move selection
- `Enter` — open the selected request
- `Esc` — back to the list

### Permissions and why each one is needed

| Permission                                   | Why                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `webRequest`                                 | Observe requests so we can capture method/URL/headers/body             |
| `storage`                                    | Persist captured requests across popup open/close                      |
| `<all_urls>`                                 | Capture traffic from any site you visit                                |
| Content-script injection on http/https pages | Read `fetch` / `XHR` response bodies (Manifest V3 `webRequest` cannot) |

The extension **does not** make any outbound network calls of its own and **does not** transmit your data anywhere. The full source code is open: <https://github.com/Aniket-bansal/Api-Inspector>.

## Category

Developer Tools

## Languages

- English (en)

## Privacy

- Single-purpose: capture and display HTTP traffic for development/debugging.
- Does not sell or transfer user data to third parties, ever.
- Does not use the data for anything unrelated to its single purpose.
- Does not use or transfer user data for creditworthiness or lending purposes.

See [PRIVACY.md](https://github.com/Aniket-bansal/Api-Inspector/blob/main/PRIVACY.md) for the full policy.

## Screenshots (capture these before submitting)

Recommended: 1280×800 or 640×400 PNG, in this order:

1. **Popup list view** with a mix of Fetch/XHR and resource types, showing filter pills + status filter chips.
2. **Detail view** of a POST request — request headers/body + response.
3. **Generated code** with the language dropdown open, showing all 7 generators.
4. **Redaction badge** active — "secrets hidden" pill in the code toolbar.
5. **Options page** — the privacy/storage/generator settings.
