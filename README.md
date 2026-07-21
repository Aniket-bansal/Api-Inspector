# Api Inspector

> A cross-browser extension that captures API requests from any website and generates ready-to-use code snippets in **seven** languages — `fetch`, `axios`, `cURL`, Python, Go, Node, and HTTPie. Like a mini DevTools Network panel purpose-built for reverse-engineering APIs.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest](https://img.shields.io/badge/Manifest-V3-success.svg)](manifest.json)
[![Chrome](https://img.shields.io/badge/Chrome-supported-success.svg)](#installation)
[![Firefox](https://img.shields.io/badge/Firefox-supported-success.svg)](#installation)
[![Tests](https://img.shields.io/badge/tests-54%20passing-brightgreen.svg)](tests/)
[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](manifest.json)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Usage](#usage)
- [Code Generation Examples](#code-generation-examples)
- [Project Structure](#project-structure)
- [Permissions](#permissions)
- [Privacy & Security](#privacy--security)
- [Technical Notes & Caveats](#technical-notes--caveats)
- [Development](#development)
- [Progress / Changelog](#progress--changelog)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

**Api Inspector** silently observes network traffic in your browser and records API calls — including request headers, bodies, and (for `fetch`/`XHR`) the matching response. From any captured request you can then generate a clean, copy-pasteable code snippet in three formats with a single click.

It is built for:

- **API reverse-engineering** — figure out what an app is calling and replay it from your own code.
- **Debugging** — inspect what a site is actually sending, including the response body.
- **Learning** — see real-world `fetch`/`axios`/`cURL` for any request a site makes.

Works on **Chrome** and **Firefox** using the same Manifest V3 codebase (no build step).

---

## Features

### Capture

- Automatically intercepts HTTP / HTTPS / WebSocket requests via `webRequest`
- Decodes request bodies: `application/json`, `application/x-www-form-urlencoded`, form data, and raw text
- Captures the matching response (status, headers, body) for `fetch` and `XMLHttpRequest` calls
- Skips browser-internal schemes (`chrome://`, `moz-extension://`, `about:`, `devtools://`, …)

### Browse

- DevTools-style filter pills: **All / Fetch/XHR / Doc / CSS / JS / Font / Img / Media / Manifest / Socket / Wasm / Other**
- Search by URL or HTTP method
- Scoped to the **active tab** by default, with an **All tabs** toggle
- Stores the **last 50** captured requests persistently in `storage.local`

### Generate

- One-click snippet generation in **seven** languages:
  - `fetch()` — native JavaScript
  - `axios` — popular HTTP client
  - `cURL` — bash command
  - Python `requests`
  - Go `net/http`
  - Node.js `got`
  - HTTPie
- Language `<select>` dropdown remembers your last pick
- One-click **Copy** to clipboard
- **Syntax highlighting** in the code panel (custom minimal highlighter)
- **Secret redaction** — by default, `Authorization`, `Cookie`, and similar headers are masked before the snippet is rendered so it's safe to share. Toggle with one click when you need the real values
- Forbidden headers (`Host`, `Connection`, `Content-Length`, `Transfer-Encoding`, …) are filtered out of generated code

### Browse UX

- **Keyboard navigation**: `/` focus search, `↑`/`↓` move selection, `Enter` open, `Esc` back
- **Status-code filter chips**: 2xx / 3xx / 4xx / 5xx / No-response
- **Per-field copy buttons** for URL, request headers, body, response headers, body
- **"Has response" indicator dot** on list items
- **Toolbar badge** with live capture count (cleared on popup open)
- Detail view state persists across popup open/close

---

## How It Works

```
┌────────────────────────────────────────────────────────────────────────┐
│                         BROWSER TAB (page)                              │
│                                                                         │
│   inject.js  ──►  wraps window.fetch / XMLHttpRequest                   │
│                   captures response (status/headers/body)               │
│                          │                                              │
│                          │ window.postMessage                           │
│                          ▼                                              │
│   content.js ──►  relays response to background via runtime.sendMessage │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     │  "api-response" message
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     BACKGROUND SERVICE WORKER                           │
│                                                                         │
│   background.js                                                         │
│   ├─ webRequest.onBeforeRequest      ► captures URL/method/body        │
│   ├─ webRequest.onBeforeSendHeaders  ► attaches request headers         │
│   ├─ webRequest.onCompleted / onErrorOccurred ► finalizes the record   │
│   └─ mergeResponse()                 ► matches & stores response info  │
│                                                                         │
│   storage.local["capturedRequests"]  ►  last 50 records (persisted)     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     │  storageLocal.get()
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            POPUP UI                                     │
│                                                                         │
│   popup.js  ►  list · filter · search · detail · codegen · copy         │
│   utils/codegen.js  ►  generateFetch / generateAxios / generateCurl     │
└────────────────────────────────────────────────────────────────────────┘
```

**Why two layers for responses?** In Manifest V3, `webRequest` can see request metadata but **cannot read response bodies**. So a content script injects `inject.js` into the page's own JS context, where it wraps `fetch`/`XHR` and reports the response back to the service worker. Responses are matched to captured requests by **URL + method + closest timestamp** (within a 30-second window).

---

## Installation

### Chrome / Edge / Brave (any Chromium browser)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this project folder
5. The **Api Inspector** icon appears in your toolbar

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select any file in this project folder (e.g. `manifest.json`)
4. The icon appears in your toolbar

> **Note:** Firefox loads temporary add-ons only for the current session. For permanent installation you'd need to sign the extension via [addons.mozilla.org](https://addons.mozilla.org/).

---

## Usage

### 1. Capture

Just browse a website. The extension automatically records API calls in the background — no UI interaction needed. Up to **50** of the most recent requests are kept.

### 2. Browse

1. Click the **Api Inspector** toolbar icon
2. View the captured request list
3. Narrow it down using:
   - **Filter pills** — by resource type (Fetch/XHR, Doc, JS, …)
   - **Search box** — by URL or HTTP method
   - **All tabs** toggle — show requests from every tab (off by default)

### 3. Inspect

Click any request to open the **detail view** with:

- HTTP method and full URL
- Request headers and body
- Response status, headers, and body (for fetch/XHR)

### 4. Generate

From the detail view, click one of:

- **Generate Fetch** — native JS
- **Generate Axios** — axios client
- **Generate cURL** — bash command

Then click **Copy** to copy the snippet to your clipboard.

---

## Code Generation Examples

Given a captured request:

```
POST https://api.example.com/users
Content-Type: application/json

{"name": "John", "email": "john@example.com"}
```

**fetch()**

```javascript
const response = await fetch("https://api.example.com/users", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "John",
    email: "john@example.com",
  }),
});

if (!response.ok) {
  throw new Error(`HTTP ${response.status}`);
}

const data = await response.json();
console.log(data);
```

**axios**

```javascript
const { data } = await axios({
  method: "post",
  url: "https://api.example.com/users",
  headers: {
    "Content-Type": "application/json",
  },
  data: {
    name: "John",
    email: "john@example.com",
  },
});

console.log(data);
```

**cURL**

```bash
curl -X POST 'https://api.example.com/users' \
  -H 'Content-Type: application/json' \
  --data-raw '{"name": "John", "email": "john@example.com"}'
```

---

## Project Structure

```
Api-Inspector/
├── manifest.json          # Extension manifest (Manifest V3, options_ui)
├── background.js          # Service worker – intercepts requests, merges responses, badge
├── content.js             # Injects inject.js, relays response data to background
├── inject.js              # Page-context fetch/XHR hook (captures responses)
├── popup.html             # Popup UI markup
├── popup.js               # Popup logic & interactions
├── styles.css             # Dark theme styles
├── options.html           # Settings page markup
├── options.js             # Settings page logic
├── options.css            # Settings page styles
├── icons/                 # Toolbar / store icons (16, 32, 48, 128 px)
├── utils/
│   ├── browser.js         # Cross-browser API shim (Chrome/Firefox)
│   ├── config.js          # Central constants & feature flags
│   ├── text.js            # Shared text helpers (truncate, escape, formatBody)
│   ├── log.js             # Tagged logger with single [api-inspector] prefix
│   ├── redact.js          # Secret-header detection + masking
│   ├── settings.js        # User-tunable settings load/save
│   ├── highlight.js       # Minimal regex syntax highlighter
│   └── codegen/
│       ├── index.js       # Registry: { id, label, language, generate }
│       ├── shared.js      # Shared codegen helpers (redact, headers, body)
│       ├── fetch.js       # generateFetch (native JS)
│       ├── axios.js       # generateAxios
│       ├── curl.js        # generateCurl (bash)
│       ├── python.js      # generatePython (requests)
│       ├── go.js          # generateGo (net/http)
│       ├── node.js        # generateNode (got)
│       └── httpie.js      # generateHttpie
├── tests/                 # node:test suite (54 tests)
│   ├── text.test.js
│   ├── codegen.test.js
│   ├── redact.test.js
│   └── highlight.test.js
├── scripts/
│   └── package.sh         # Build a store-ready .zip excluding dev files
├── store/
│   ├── description.md     # Chrome Web Store + AMO listing copy
│   └── README.md          # Asset capture workflow + submission checklist
├── .github/workflows/
│   └── ci.yml             # Lint + format check + tests on push/PR
├── PRIVACY.md             # Privacy policy (no data leaves the browser)
├── LICENSE                # MIT
├── package.json           # Dev tooling (eslint, prettier, node:test)
└── README.md              # This file
```

---

## Permissions

| Permission                      | Why it's needed                                          |
| ------------------------------- | -------------------------------------------------------- |
| `webRequest`                    | Intercept network requests to capture metadata & bodies  |
| `storage`                       | Persist captured requests across popup open/close cycles |
| `<all_urls>`                    | Observe requests on any site the user browses            |
| `host_permissions` (http/https) | Inject content script for response capture               |

The extension does **not** make any outbound network calls of its own and does **not** transmit captured data anywhere — everything stays in local browser storage.

---

## Privacy & Security

Api Inspector was designed with a hard privacy constraint from day one: **your data never leaves your browser.**

- **No analytics, telemetry, or remote logging.** There is no server.
- **All captured traffic lives in `storage.local`** on this machine. Clear it any time via the **Clear** button in the popup, or uninstall the extension.
- **Secret headers are masked by default** (`Authorization`, `Cookie`, API-key patterns, anything matching `*token*` / `*secret*`) when generating code, so you can safely paste snippets into chat, bug reports, or tickets.
- **Open source.** Read the code: <https://github.com/Aniket-bansal/Api-Inspector>. Read the full policy: [`PRIVACY.md`](PRIVACY.md).

If you find a security issue, please open an issue at <https://github.com/Aniket-bansal/Api-Inspector/issues> rather than publicly disclosing.

---

## Technical Notes & Caveats

- **Responses are only captured for `fetch`/`XHR` calls.** Other resource types (images, scripts, stylesheets) only have request-side data, because `webRequest` cannot read response bodies in MV3 and the page-context hook only wraps `fetch`/`XMLHttpRequest`.
- **Response matching** is best-effort: a captured response is matched to a stored request by `url + method + closest timestamp` within a 30-second window. Under very high request rates this could occasionally mismatch.
- **Forbidden headers** (`Host`, `Connection`, `Content-Length`, `Transfer-Encoding`, `Keep-Alive`, `Proxy-Authenticate`, `Proxy-Authorization`, `TE`, `Trailer`, `Upgrade`) are stripped from generated snippets since browsers refuse to set them anyway.
- **Body truncation:** Request/response bodies longer than **100,000 characters** are truncated.
- **Storage cap:** Maximum **50** requests stored; oldest entries are discarded first.
- **Browser internals ignored:** Requests to `chrome://`, `moz-extension://`, `edge://`, `about:`, `devtools://` are never captured.
- **Cross-browser:** The same code runs on Chrome and Firefox via `utils/browser.js`, which abstracts the `chrome.*` vs `browser.*` (callback vs Promise) differences.

---

## Development

No build step, no bundler, no dependencies. The extension uses native ES modules.

### Workflow

1. Edit any source file
2. Go to `chrome://extensions/` (or `about:debugging` in Firefox)
3. Click **Reload** on the extension card
4. Changes to `background.js` always require a reload; popup/UI changes show on the next popup open

### Conventions

- Plain modern JavaScript (ES2020+), JSDoc comments for editor hints
- No dependencies — only the browser extension APIs
- Keep `utils/browser.js` as the single entry point for any `chrome.*` / `browser.*` call
- Keep `utils/codegen.js` pure (no DOM, no I/O) so generators stay testable

---

## Progress / Changelog

> This section is updated after every meaningful change. Add new entries at the top of the table below using the format:
>
> `| YYYY-MM-DD | vMAJOR.MINOR.PATCH | <one-line summary> |`

| Date       | Version      | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-20 | 1.1.0        | **Phase 6 — Distribution readiness.** Bumped version to 1.1.0, set `minimum_chrome_version` to 110, renamed action title to "Api Inspector", refreshed description. Added `scripts/package.sh` (produces `dist/api-inspector-v1.1.0.zip`, verified working at 52 KB). Added `store/description.md` (short + long listing copy, permissions justification, screenshot checklist) and `store/README.md` (capture workflow + submission checklist). Expanded README with badges, full project structure tree, and a dedicated **Privacy & Security** section.                                                                                                          |
| 2026-07-20 | _unreleased_ | **Phase 5 — Options page.** New `options.html` / `options.js` / `options.css` with cards for **Privacy & secrets**, **Capture & storage** (sliders for `maxStored` 25–500 and `maxBodyChars` 10k–1M, badge toggle), **Code generators** (per-generator checkboxes + default-generator dropdown), and **Theme** (dark / light / system). Wired `options_ui` in `manifest.json` with `open_in_tab: true`. All settings round-trip through `storage.local[SETTINGS_KEY]`.                                                                                                                                                                                              |
| 2026-07-20 | _unreleased_ | **Phase 4 — UX polish.** Keyboard navigation (`/` focus search, `↑`/`↓` move, `Enter` open, `Esc` back). Status-code filter chips. Per-field copy buttons on URL, headers, body. "Has response" green dot + colour-coded status badge per row. Detail view persists across popup open/close via `storage.local.popupState`. New `utils/highlight.js`: minimal single-pass regex highlighter for JS / bash / Python / Go, layered beneath a transparent textarea. 6 new tests (54 total).                                                                                                                                                                            |
| 2026-07-20 | _unreleased_ | **Phase 3 — New generators.** Split `utils/codegen.js` into `utils/codegen/` (one file per target: `fetch.js`, `axios.js`, `curl.js`, `python.js`, `go.js`, `node.js`, `httpie.js`), plus `shared.js` and `index.js` (registry of `{id, label, language, generate}`). Replaced the three Generate buttons with a single `<select>` dropdown; selection persists via `defaultGenerator` setting. 27 generator tests covering all 7 languages.                                                                                                                                                                                                                        |
| 2026-07-20 | _unreleased_ | **Phase 2 — Security & privacy.** New `utils/redact.js` (lowercase-name set + regex patterns for `token`/`secret`/`api-key`, scheme-preserving value masker). New `utils/settings.js` (`DEFAULT_SETTINGS`, `loadSettings` / `saveSettings`). Every generator accepts `{redactSecrets}`; popup got a **🔒 Redact** toggle plus a "secrets hidden" pill badge. Background service worker keeps a live capture-count badge via `chrome.action.setBadgeText`, gated by `showBadge`. New `PRIVACY.md`. 13 new tests (41 total).                                                                                                                                          |
| 2026-07-20 | _unreleased_ | **Phase 1 — Correctness fixes.** `inject.js`: rewrote XHR wrapper as a `class extends XMLHttpRequest` (restores static constants `DONE`/`UNSENT`/… and `instanceof`), added `content-length` guard, skip body read for `GET`/`HEAD`. `background.js`: fixed `onCompleted`/`onBeforeSendHeaders` race via a 2-second header grace window; smarter pending eviction. Shrunk `RESPONSE_MATCH_WINDOW_MS` from 30s → 10s. `codegen.js`: deleted dead `wrapLongLines`, deduped helpers, fixed the long-standing `formatBodyLiteral` double-encoding bug. `popup.js`: live updates via `chrome.storage.onChanged`; confirm-before-Clear. Added 5 new tests (28 total).     |
| 2026-07-20 | _unreleased_ | **Phase 0 — Foundations & tooling.** Added `package.json` (node:test, eslint, prettier), CI workflow, `.gitignore`, `.prettierrc.json`, flat ESLint config. Introduced `utils/config.js` (centralized `STORAGE_KEY`, `MAX_STORED`, `MAX_BODY_CHARS`, `MAX_PENDING`, `RESPONSE_MATCH_WINDOW_MS`, ignored URLs / allowed protocols / forbidden headers), `utils/text.js` (shared `truncate`, `escapeSingleQuoted`, `escapeBashSingleQuoted`, `formatBodyLiteral`, etc.), `utils/log.js` (single `[api-inspector]` prefix). Refactored `background.js` and `popup.js` to consume the new modules. Added 23 unit tests in `tests/`. Normalized all files with prettier. |
| 2026-07-20 | _unreleased_ | **README rewrite.** Added full architecture diagram, table of contents, badges, technical-notes section, and this living Progress table.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-03-24 | 1.0.0 (WIP)  | **Response capture + tab scoping (uncommitted).** Added `content.js` + `inject.js` to hook page `fetch`/`XHR` and capture response status, headers, and body. Added per-tab scoping with an **All tabs** toggle. Added response detail blocks to the popup. Added icons (16/32/48/128), LICENSE, opencode config.                                                                                                                                                                                                                                                                                                                                                   |
| 2026-03-24 | 1.0.0        | **Rename.** Extension renamed from "Network to Code" to "Api Inspector".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-03-24 | 1.0.0        | **Initial README.** Added usage flows and code-generation examples.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-03-24 | 1.0.0        | **Initial release.** Project scaffolding: manifest, background service worker, popup UI, dark theme styles, cross-browser shim, and `fetch`/`axios`/`cURL` code generators. Captures up to 50 requests with filter pills, search, and one-click copy.                                                                                                                                                                                                                                                                                                                                                                                                               |

---

## Roadmap

Planned work, tracked as a multi-phase plan (P0 → P6). Completed items are checked off as each phase lands.

### Phase 0 — Foundations & tooling ✅

- [x] Centralize constants & feature flags in `utils/config.js`
- [x] Share text helpers (`truncate`, `escape*`, `formatBodyLiteral`) via `utils/text.js`
- [x] Single logger with `[api-inspector]` prefix in `utils/log.js`
- [x] `package.json` with `node:test`, ESLint 9 flat config, Prettier
- [x] GitHub Actions CI (lint + format check + test)
- [x] Unit tests for `utils/text.js` and smoke tests for the existing generators
- [x] Refactor `background.js` and `popup.js` to consume the new modules

### Phase 1 — Correctness fixes ✅

- [x] Fix `inject.js` XHR prototype chain (currently breaks `instanceof` and loses static constants)
- [x] Stream-safety: cap `response.clone().text()` size before buffering
- [x] Resolve the `onCompleted` / `onBeforeSendHeaders` race in `background.js`
- [x] Don't evict pending records that haven't received headers yet
- [x] Tighten response matching window (30s → 10s; `requestId` plumbing deferred)
- [x] Delete dead `wrapLongLines` from `codegen.js`
- [x] Fix `formatBodyLiteral` to stop double-encoding non-JSON bodies
- [x] Live popup updates via `chrome.storage.onChanged`
- [x] Confirmation prompt before **Clear**
- [x] Skip body read for GET/HEAD requests (spec compliance)
- [ ] Capture `Request` body in `inject.js` (deferred — `webRequest` already captures request bodies for ~99% of cases; revisit if we see gaps)

### Phase 2 — Security & privacy ✅

- [x] `utils/redact.js` — secret-header detection & value masking
- [x] `redactSecretsOnCopy` (default ON) and `redactSecretsOnDisplay` (default OFF)
- [x] Mask `Cookie` / `Authorization` in generated code unless explicitly toggled
- [x] `PRIVACY.md` for store submission
- [ ] Make `inject.js` hook harder to detect by anti-bot pages (deferred — keep the wrapper surface minimal for now)

### Phase 3 — New code generators ✅

- [x] Refactor `utils/codegen.js` → `utils/codegen/` (one file per target)
- [x] Python `requests` generator
- [x] Go `net/http` generator
- [x] Node `got` generator
- [x] HTTPie generator
- [x] Language `<select>` dropdown in the popup; persist last pick
- [x] Tests for every generator (27 cases across all 7 languages)

### Phase 4 — UX polish ✅

- [x] Keyboard nav (`/` focus search, `Esc` back, `↑↓` list, `Enter` detail)
- [x] Status-code filter chips (2xx / 3xx / 4xx / 5xx / No-response)
- [x] Per-field copy buttons
- [x] Syntax highlighting (custom single-pass regex highlighter — vendored highlight.js turned out unnecessary)
- [x] Toolbar badge with capture count
- [x] "Has response" indicator in list items
- [x] Persist last-selected request across popup open/close
- [ ] Size + duration columns (deferred — needs response-size capture plumbing)

### Phase 5 — Options page ✅

- [x] `options.html` / `options.js` / `options.css` with `options_ui` in manifest
- [x] User-tunable storage cap (25–500), body limit (10k–1M), theme, redaction defaults, enabled generators, badge toggle

### Phase 6 — Distribution readiness ✅

- [x] Privacy policy at `PRIVACY.md` (Chrome Web Store requirement)
- [x] Store assets: `store/description.md` (short + long copy) and `store/README.md` (screenshot workflow)
- [x] `scripts/package.sh` to build a clean `.zip` excluding dev files (verified working: 52 KB)
- [x] Manifest polish: version bump to 1.1.0, `minimum_chrome_version: "110"`, action title fix
- [ ] Real screenshots / demo GIF in README (deferred — capture from a live load once a stable build is up)

### Stretch (not yet started)

- [ ] Capture `Request` body in `inject.js` (deferred from Phase 1)
- [ ] Export captured requests as **HAR** (HTTP Archive) JSON
- [ ] **Import / replay** a captured request
- [ ] **Large storage** mode via `indexedDB`
- [ ] Per-request **notes / starring**
- [ ] Apply theme to the popup (currently options-page only)
- [ ] Apply popup theme via the same `data-theme` attribute the options page uses

---

## License

[MIT](LICENSE) © Aniket Bansal
