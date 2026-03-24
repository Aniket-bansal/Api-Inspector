# Network to Code

A cross-browser extension that captures API requests from websites and generates ready-to-use code snippets for **fetch**, **axios**, and **cURL**.

## Features

- Capture HTTP/HTTPS/WebSocket requests automatically
- Filter requests by type (Fetch/XHR, Doc, CSS, JS, Img, etc.)
- Search requests by URL or method
- Generate code snippets in three formats:
  - `fetch()` — native JavaScript
  - `axios` — popular HTTP client
  - `cURL` — command line
- One-click copy to clipboard
- Supports Chrome and Firefox (Manifest V3)

## Installation

### Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `api-reverse-engineer` folder
5. The extension icon appears in your toolbar

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select any file in the `api-reverse-engineer` folder
4. The extension icon appears in your toolbar

## Usage Flows

### Flow 1: Capturing API Requests

```
┌─────────────────────────────────────────────────────────┐
│                    BACKGROUND PROCESS                   │
├─────────────────────────────────────────────────────────┤
│  1. Browse any website                                  │
│  2. Extension automatically intercepts requests         │
│  3. Request metadata stored (URL, method, headers,     │
│     body, resource type)                                │
│  4. Last 50 requests kept in browser storage            │
└─────────────────────────────────────────────────────────┘
```

### Flow 2: Viewing Captured Requests

```
┌─────────────────────────────────────────────────────────┐
│                      POPUP VIEW                         │
├─────────────────────────────────────────────────────────┤
│  1. Click extension icon in toolbar                    │
│  2. See list of captured requests                      │
│  3. Use filter pills to narrow by type:                │
│     • All / Fetch/XHR / Doc / CSS / JS / Font          │
│     • Img / Media / Manifest / Socket / Wasm / Other   │
│  4. Use search box to filter by URL or HTTP method     │
│  5. Click any request to see details                   │
└─────────────────────────────────────────────────────────┘
```

### Flow 3: Generating Code Snippets

```
┌─────────────────────────────────────────────────────────┐
│                    DETAIL VIEW                          │
├─────────────────────────────────────────────────────────┤
│  1. Select a request from the list                     │
│  2. View request details:                               │
│     • HTTP Method (GET, POST, PUT, etc.)               │
│     • Full URL                                          │
│     • Request Headers                                   │
│     • Request Body (if any)                            │
│  3. Click one of:                                       │
│     • [Generate Fetch] — JS fetch() code              │
│     • [Generate Axios] — Axios library code            │
│     • [Generate cURL] — Bash cURL command              │
│  4. Code appears in the output area                    │
│  5. Click [Copy] to copy to clipboard                  │
└─────────────────────────────────────────────────────────┘
```

### Flow 4: Example Output

**Captured Request:**
```
POST https://api.example.com/users
Content-Type: application/json

{"name": "John", "email": "john@example.com"}
```

**Generated Fetch:**
```javascript
const response = await fetch('https://api.example.com/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    "name": "John",
    "email": "john@example.com"
  })
});

if (!response.ok) {
  throw new Error(`HTTP ${response.status}`);
}

const data = await response.json();
console.log(data);
```

**Generated Axios:**
```javascript
const { data } = await axios({
  method: 'post',
  url: 'https://api.example.com/users',
  headers: {
    'Content-Type': 'application/json',
  },
  data: {
    "name": "John",
    "email": "john@example.com"
  }
});

console.log(data);
```

**Generated cURL:**
```bash
curl -X POST 'https://api.example.com/users' \
  -H 'Content-Type: application/json' \
  --data-raw '{"name": "John", "email": "john@example.com"}'
```

## Project Structure

```
api-reverse-engineer/
├── manifest.json       # Extension manifest (MV3)
├── background.js       # Service worker - intercepts requests
├── popup.html          # Popup UI markup
├── popup.js            # Popup logic & interactions
├── styles.css          # Dark theme styles
└── utils/
    ├── browser.js      # Cross-browser API shim
    └── codegen.js      # Code generation functions
```

## Permissions

| Permission | Purpose |
|------------|---------|
| `webRequest` | Intercept network requests |
| `storage` | Persist captured requests |
| `<all_urls>` | Access to all URLs for request capture |

## Notes

- **Forbidden headers** like `Content-Length`, `Host`, `Connection` are automatically filtered out in generated code
- **Request body truncation**: Bodies longer than 100,000 characters are truncated
- **Storage limit**: Maximum 50 requests stored; older requests are discarded
- **Browser internals**: Requests to `chrome://`, `moz-extension://`, `about:`, etc. are ignored

## Development

No build step required. The extension uses native JavaScript modules.

To modify:
1. Edit source files
2. Reload the extension in Chrome/Firefox
3. Changes to `background.js` require extension reload

## License

MIT