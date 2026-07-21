/**
 * Popup UI: list captured requests, show details, generate & copy code.
 */

import { getBrowser, storageLocal } from "./utils/browser.js";
import { GENERATORS, getGenerator } from "./utils/codegen/index.js";
import { STORAGE_KEY, SETTINGS_KEY } from "./utils/config.js";
import { loadSettings } from "./utils/settings.js";
import { maskSecretsInHeaders } from "./utils/redact.js";
import { highlight } from "./utils/highlight.js";

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const el = {
  status: document.getElementById("status"),
  viewList: document.getElementById("view-list"),
  viewDetail: document.getElementById("view-detail"),
  list: document.getElementById("request-list"),
  emptyHint: document.getElementById("empty-hint"),
  emptyFilterHint: document.getElementById("empty-filter-hint"),
  btnToggleFilters: document.getElementById("btn-toggle-filters"),
  filterSearchPanel: document.getElementById("filter-search-panel"),
  filterSearch: document.getElementById("filter-search"),
  filterPills: document.getElementById("filter-pills"),
  btnClear: document.getElementById("btn-clear"),
  allTabsToggle: document.getElementById("all-tabs-toggle"),
  btnBack: document.getElementById("btn-back"),
  detailMethod: document.getElementById("detail-method"),
  detailUrl: document.getElementById("detail-url"),
  detailHeaders: document.getElementById("detail-headers"),
  detailBody: document.getElementById("detail-body"),
  detailStatus: document.getElementById("detail-status"),
  detailResponseHeaders: document.getElementById("detail-response-headers"),
  detailResponseBody: document.getElementById("detail-response-body"),
  langSelect: document.getElementById("lang-select"),
  btnGenerate: document.getElementById("btn-generate"),
  redactToggle: document.getElementById("redact-toggle"),
  redactBadge: document.getElementById("redact-badge"),
  codeOutput: document.getElementById("code-output"),
  codeHighlight: document.getElementById("code-highlight"),
  btnCopy: document.getElementById("btn-copy"),
  statusPills: document.getElementById("status-pills"),
};

/** @type {any[]} */
let requests = [];
/** @type {any | null} */
let selected = null;

/** @type {string} DevTools-style category id */
let activeFilter = "fetch";
/** @type {string} */
let searchQuery = "";

/** @type {number} id of the tab the popup was opened for, -1 if unknown */
let activeTabId = -1;
let showAllTabs = false;

/**
 * The currently-selected generator id. Persisted across popup open/close via
 * the `defaultGenerator` setting.
 * @type {string}
 */
let currentGenerator = "fetch";

/** @type {boolean} mirror of the redact-secret-toggle checkbox state. */
let redactSecretsOnCopy = true;

/** @type {boolean} mirror of the display-redaction setting. */
let redactSecretsOnDisplay = false;

/** @type {string} active status-code filter ("all" | "2xx" | "3xx" | "4xx" | "5xx" | "none"). */
let activeStatusFilter = "all";

/** @type {number} keyboard-cursor index into the currently-visible list (-1 = none). */
let cursorIndex = -1;

/** @type {string|null} persisted id of the most-recently-selected request. */
let lastSelectedId = /** @type {string|null} */ (null);

/** Status-filter chip definitions. */
const STATUS_PILLS = Object.freeze([
  { id: "all", label: "Any status" },
  { id: "2xx", label: "2xx" },
  { id: "3xx", label: "3xx" },
  { id: "4xx", label: "4xx" },
  { id: "5xx", label: "5xx" },
  { id: "none", label: "No response" },
]);

/** @type {{ id: string, label: string }[]} */
const FILTER_PILLS = [
  { id: "all", label: "All" },
  { id: "fetch", label: "Fetch/XHR" },
  { id: "doc", label: "Doc" },
  { id: "css", label: "CSS" },
  { id: "js", label: "JS" },
  { id: "font", label: "Font" },
  { id: "img", label: "Img" },
  { id: "media", label: "Media" },
  { id: "manifest", label: "Manifest" },
  { id: "socket", label: "Socket" },
  { id: "wasm", label: "Wasm" },
  { id: "other", label: "Other" },
];

// ---------------------------------------------------------------------------
// Filter: map stored resourceType + URL → DevTools bucket
// ---------------------------------------------------------------------------

/**
 * @param {any} req
 * @returns {string}
 */
function getPrimaryCategory(req) {
  const url = req.url || "";
  const rt = String(req.resourceType || "xmlhttprequest").toLowerCase();

  let path = "";
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    path = "";
  }

  if (/\.wasm(\?|#|$)/i.test(url)) return "wasm";
  if (/\.webmanifest$/i.test(path) || /(^|\/)manifest\.json$/i.test(path)) return "manifest";

  try {
    const proto = new URL(url).protocol;
    if (proto === "ws:" || proto === "wss:") return "socket";
  } catch {
    /* ignore */
  }
  if (rt === "websocket") return "socket";

  if (rt === "main_frame" || rt === "sub_frame") return "doc";
  if (rt === "stylesheet") return "css";
  if (rt === "script") return "js";
  if (rt === "font") return "font";
  if (rt === "image") return "img";
  if (rt === "media") return "media";
  if (rt === "xmlhttprequest" || rt === "ping") return "fetch";

  return "other";
}

/**
 * @param {any} req
 * @returns {string} status bucket: "2xx".."5xx", "none" (no response), or "other"
 */
function getStatusBucket(req) {
  const status = req?.response?.status;
  if (typeof status !== "number" || status <= 0) return "none";
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500) return "5xx";
  return "other";
}

/**
 * @returns {any[]}
 */
function getVisibleRequests() {
  const q = searchQuery.trim().toLowerCase();
  return requests.filter((req) => {
    if (!showAllTabs && activeTabId !== -1 && req.tabId !== activeTabId) return false;
    if (activeFilter !== "all" && getPrimaryCategory(req) !== activeFilter) return false;
    if (activeStatusFilter !== "all" && getStatusBucket(req) !== activeStatusFilter) return false;
    if (!q) return true;
    const hay = `${req.method || ""} ${req.url || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderFilterPills() {
  el.filterPills.innerHTML = "";
  for (const { id, label } of FILTER_PILLS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "filter-pill" + (id === activeFilter ? " filter-pill-active" : "");
    b.dataset.filter = id;
    b.textContent = label;
    b.setAttribute("aria-pressed", id === activeFilter ? "true" : "false");
    b.addEventListener("click", () => {
      activeFilter = id;
      renderFilterPills();
      renderList();
    });
    el.filterPills.appendChild(b);
  }
}

function renderStatusPills() {
  if (!el.statusPills) return;
  el.statusPills.innerHTML = "";
  for (const { id, label } of STATUS_PILLS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "filter-pill" + (id === activeStatusFilter ? " filter-pill-active" : "");
    b.dataset.status = id;
    b.textContent = label;
    b.setAttribute("aria-pressed", id === activeStatusFilter ? "true" : "false");
    b.addEventListener("click", () => {
      activeStatusFilter = id;
      renderStatusPills();
      renderList();
    });
    el.statusPills.appendChild(b);
  }
}

function setFiltersExpanded(expanded) {
  el.filterSearchPanel.classList.toggle("hidden", !expanded);
  el.btnToggleFilters.setAttribute("aria-expanded", expanded ? "true" : "false");
  el.btnToggleFilters.classList.toggle("filters-toggle-open", expanded);
  if (expanded) {
    el.filterSearch.focus();
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function setStatus(msg, isError = false) {
  el.status.textContent = msg || "";
  el.status.classList.toggle("status-error", Boolean(isError && msg));
}

function showList() {
  el.viewList.classList.remove("hidden");
  el.viewDetail.classList.add("hidden");
  selected = null;
  lastSelectedId = null;
  void storageLocal.set({ popupState: { lastSelectedId: null } }).catch(() => {});
  el.codeOutput.value = "";
  if (el.codeHighlight) el.codeHighlight.innerHTML = "";
}

function showDetail(req) {
  selected = req;
  lastSelectedId = req.id ?? null;
  // Persist so the popup can restore the same detail view after close/reopen.
  if (lastSelectedId) {
    void storageLocal.set({ popupState: { lastSelectedId } }).catch(() => {});
  }
  el.viewList.classList.add("hidden");
  el.viewDetail.classList.remove("hidden");

  el.detailMethod.textContent = req.method || "";
  el.detailUrl.textContent = req.url || "";

  const reqHeaders = redactSecretsOnDisplay ? maskSecretsInHeaders(req.headers) : req.headers;
  el.detailHeaders.textContent = formatHeaders(reqHeaders);
  el.detailBody.textContent = req.body != null && req.body !== "" ? req.body : "—";

  const resp = req.response;
  el.detailStatus.textContent = resp
    ? `${resp.status} ${resp.statusText || ""}`.trim()
    : "— (no response captured)";
  const respHeaders = resp
    ? redactSecretsOnDisplay
      ? maskSecretsInHeaders(resp.headers)
      : resp.headers
    : null;
  el.detailResponseHeaders.textContent = respHeaders ? formatHeaders(respHeaders) : "—";
  el.detailResponseBody.textContent =
    resp && resp.body != null && resp.body !== "" ? resp.body : "—";

  el.codeOutput.value = "";
  if (el.codeHighlight) el.codeHighlight.innerHTML = "";
  el.redactBadge.classList.add("hidden");
}

function formatHeaders(headers) {
  if (!headers || !headers.length) return "—";
  return headers.map((h) => `${h.name}: ${h.value}`).join("\n");
}

function truncateUrl(url, max = 64) {
  if (!url) return "";
  return url.length > max ? `${url.slice(0, max)}…` : url;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function loadRequests() {
  try {
    const [tab] = await getBrowser().tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id ?? -1;
  } catch (e) {
    console.error(e);
    activeTabId = -1;
  }

  // Restore the last-selected request id (if any) from the previous popup open.
  try {
    const stateData = await storageLocal.get("popupState");
    const stored = stateData?.popupState;
    if (stored && typeof stored.lastSelectedId === "string") {
      lastSelectedId = stored.lastSelectedId;
    }
  } catch {
    /* ignore */
  }

  await refreshRequests();

  // If the user had a request selected last time the popup was open, restore
  // the detail view (best-effort — only if the request is still in storage).
  if (lastSelectedId) {
    const found = requests.find((r) => r.id === lastSelectedId);
    if (found) showDetail(found);
  }
}

/**
 * Re-read captured requests from storage and re-render. Preserves the
 * currently-selected detail view by matching on request id — so when the
 * background merges a response into the selected request, the detail panel
 * updates live.
 */
async function refreshRequests() {
  try {
    const data = await storageLocal.get(STORAGE_KEY);
    requests = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  } catch (e) {
    console.error(e);
    requests = [];
    setStatus("Could not read storage.", true);
    return;
  }

  // If the user is viewing a detail, swap the stale object out for its
  // freshly-updated twin so the panel reflects any response merges.
  if (selected && lastSelectedId) {
    const fresh = requests.find((r) => r.id === lastSelectedId);
    if (fresh) {
      selected = fresh;
      // Only re-render detail if it's the current view; otherwise the next
      // showDetail() will pick up the new object.
      if (!el.viewDetail.classList.contains("hidden")) {
        showDetail(selected);
      }
    } else {
      // Selected request was pushed out of the storage window.
      selected = null;
      lastSelectedId = null;
      showList();
      setStatus("Selected request is no longer available.");
    }
  }

  renderFilterPills();
  renderStatusPills();
  renderList();
}

async function clearAll() {
  // Reset local view state *before* the storage write so the subsequent
  // storage.onChanged-driven refresh doesn't mistake this for an
  // externally-driven loss of the selected request.
  selected = null;
  showList();
  try {
    await storageLocal.set({ [STORAGE_KEY]: [] });
    setStatus("Cleared.");
  } catch (e) {
    console.error(e);
    setStatus("Clear failed.", true);
  }
}

function renderList() {
  el.list.innerHTML = "";
  const visible = getVisibleRequests();
  const emptyStore = requests.length === 0;
  const emptyFiltered = !emptyStore && visible.length === 0;

  const emptyThisTab =
    !emptyStore &&
    visible.length === 0 &&
    !showAllTabs &&
    requests.some((r) => r.tabId !== activeTabId);
  el.emptyHint.classList.toggle("hidden", !emptyStore);
  el.emptyFilterHint.textContent = emptyThisTab
    ? "No requests captured for this tab yet. Try “All tabs”, or reload the page."
    : "No requests match the current filters or search.";
  el.emptyFilterHint.classList.toggle("hidden", !emptyFiltered);

  // Keep the cursor in range; default to first item when none selected.
  if (cursorIndex < 0 || cursorIndex >= visible.length) {
    cursorIndex = visible.length > 0 ? 0 : -1;
  }

  for (let i = 0; i < visible.length; i++) {
    const req = visible[i];
    const li = document.createElement("li");
    li.className = "request-item";
    if (req.response) li.classList.add("has-response");
    if (i === cursorIndex) li.classList.add("selected");
    li.dataset.cursorIndex = String(i);
    const cat = getPrimaryCategory(req);
    const status = req.response?.status ? `${req.response.status}` : "";
    li.innerHTML = `
      <span class="method-badge">${escapeHtml(req.method || "?")}</span>
      <span class="type-pill" title="Resource type">${escapeHtml(cat)}</span>
      <span class="request-url" title="${escapeAttr(req.url)}">${escapeHtml(truncateUrl(req.url, 56))}</span>
      ${status ? `<span class="status-pill status-${status[0]}x">${escapeHtml(status)}</span>` : ""}
    `;
    li.addEventListener("click", () => {
      cursorIndex = i;
      showDetail(req);
    });
    li.addEventListener("mouseenter", () => {
      cursorIndex = i;
      updateCursorClasses();
    });
    el.list.appendChild(li);
  }
}

/** Toggle only the `selected` class — used by mouse hover + keyboard nav. */
function updateCursorClasses() {
  const items = el.list.querySelectorAll(".request-item");
  items.forEach((it, i) => {
    it.classList.toggle("selected", i === cursorIndex);
  });
}

/** Move the keyboard cursor, optionally opening the new item. */
function moveCursor(delta, open = false) {
  const visible = getVisibleRequests();
  if (visible.length === 0) return;
  let next = cursorIndex + delta;
  if (next < 0) next = visible.length - 1;
  if (next >= visible.length) next = 0;
  cursorIndex = next;
  updateCursorClasses();
  // Ensure the new row is in view.
  const item = el.list.querySelector(`.request-item[data-cursor-index="${next}"]`);
  item?.scrollIntoView({ block: "nearest" });
  if (open) showDetail(visible[next]);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Codegen + clipboard
// ---------------------------------------------------------------------------

async function copyCode() {
  const text = el.codeOutput.value;
  if (!text) {
    setStatus("Nothing to copy. Generate code first.");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.");
  } catch (e) {
    console.error(e);
    el.codeOutput.select();
    setStatus("Clipboard blocked — code selected; press Ctrl+C.", true);
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

el.btnBack.addEventListener("click", showList);
el.btnToggleFilters.addEventListener("click", () => {
  const open = el.filterSearchPanel.classList.contains("hidden");
  setFiltersExpanded(open);
});
el.filterSearch.addEventListener("input", () => {
  searchQuery = el.filterSearch.value;
  renderList();
});

el.btnClear.addEventListener("click", () => {
  if (requests.length === 0) return;
  if (!window.confirm(`Clear all ${requests.length} captured request(s)? This cannot be undone.`)) {
    return;
  }
  void clearAll();
});

el.allTabsToggle.addEventListener("change", () => {
  showAllTabs = el.allTabsToggle.checked;
  renderList();
});

// Populate the language dropdown from the generator registry.
function renderLangSelect() {
  el.langSelect.innerHTML = "";
  for (const g of GENERATORS) {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.label;
    el.langSelect.appendChild(opt);
  }
  el.langSelect.value = currentGenerator;
}

el.langSelect.addEventListener("change", () => {
  currentGenerator = el.langSelect.value;
  // Persist selection for next time.
  void storageLocal.get(SETTINGS_KEY).then((data) => {
    const settings = data[SETTINGS_KEY] || {};
    settings.defaultGenerator = currentGenerator;
    void storageLocal.set({ [SETTINGS_KEY]: settings });
  });
  // If the user had already generated code, regenerate with the new language.
  if (selected && el.codeOutput.value) runGenerator();
});

el.btnGenerate.addEventListener("click", () => {
  if (!selected) return;
  runGenerator();
});

/**
 * Run the currently-selected generator against `selected` and update the code
 * output area. Honours the redact-secrets toggle.
 */
function runGenerator() {
  if (!selected) return;
  const gen = getGenerator(currentGenerator);
  if (!gen) {
    setStatus(`Unknown generator: ${currentGenerator}`, true);
    return;
  }
  try {
    const code = gen.generate(selected, { redactSecrets: redactSecretsOnCopy });
    el.codeOutput.value = code;
    if (el.codeHighlight) {
      el.codeHighlight.innerHTML = highlight(code, gen.language);
    }
    el.redactBadge.classList.toggle("hidden", !redactSecretsOnCopy);
    setStatus(`${gen.label} snippet generated.`);
  } catch (e) {
    console.error(e);
    setStatus("Codegen failed.", true);
  }
}

el.redactToggle.addEventListener("change", async () => {
  redactSecretsOnCopy = el.redactToggle.checked;
  // Persist the user's preference for next time.
  try {
    const data = await storageLocal.get(SETTINGS_KEY);
    const settings = data[SETTINGS_KEY] || {};
    settings.redactSecretsOnCopy = redactSecretsOnCopy;
    await storageLocal.set({ [SETTINGS_KEY]: settings });
  } catch (e) {
    console.error(e);
  }
  // Re-run the active generator so the user sees the effect immediately.
  if (selected && el.codeOutput.value) runGenerator();
});

el.btnCopy.addEventListener("click", () => void copyCode());

// ---------------------------------------------------------------------------
// Live updates: re-render whenever the background service worker writes to
// storage (new capture, response merge, clear). Cheap because we just swap
// the in-memory array and re-render the list/detail.
// ---------------------------------------------------------------------------

getBrowser().storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!Object.prototype.hasOwnProperty.call(changes, STORAGE_KEY)) return;
  void refreshRequests();
});

// ---------------------------------------------------------------------------
// Keyboard navigation (/, Esc, ↑↓, Enter). Bound on document so it works
// regardless of focus, but ignored when the user is typing in a form field
// other than the search box (which has its own Esc handler).
// ---------------------------------------------------------------------------

document.addEventListener("keydown", (e) => {
  const tag = (e.target?.tagName || "").toUpperCase();
  const typingInField = tag === "INPUT" && e.target?.id !== "filter-search";
  const inSearch = e.target?.id === "filter-search";

  // "/" focuses the search box from anywhere.
  if (e.key === "/" && !inSearch && !typingInField) {
    e.preventDefault();
    setFiltersExpanded(true);
    el.filterSearch.focus();
    return;
  }

  // Esc: if search is focused, just blur it; otherwise go back from detail.
  if (e.key === "Escape") {
    if (inSearch) {
      el.filterSearch.blur();
      return;
    }
    if (!el.viewDetail.classList.contains("hidden")) {
      showList();
    }
    return;
  }

  // ↑ / ↓ / Enter only when on the list view and not typing in a field.
  if (!el.viewList.classList.contains("hidden") && !typingInField) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveCursor(1, false);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveCursor(-1, false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      moveCursor(0, true);
    }
  }
});

// ---------------------------------------------------------------------------
// Per-field copy buttons (data-copy-target attribute).
// ---------------------------------------------------------------------------

document.addEventListener("click", async (e) => {
  const btn = /** @type {HTMLElement} */ (e.target);
  if (!btn || !btn.classList.contains("copy-mini")) return;
  const id = btn.getAttribute("data-copy-target");
  if (!id) return;
  const el2 = document.getElementById(id);
  if (!el2) return;
  const text = el2.textContent || "";
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied.");
  } catch {
    setStatus("Clipboard blocked.", true);
  }
});

// Sync scroll between the (transparent, top-most) textarea and the
// (absolutely positioned) highlight layer beneath it.
if (el.codeOutput && el.codeHighlight) {
  el.codeOutput.addEventListener("scroll", () => {
    el.codeHighlight.scrollTop = el.codeOutput.scrollTop;
    el.codeHighlight.scrollLeft = el.codeOutput.scrollLeft;
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/**
 * Read user settings and reflect them in the popup:
 *  - redactSecretsOnCopy drives the toggle checkbox + the active generator opt
 *  - redactSecretsOnDisplay drives detail-panel rendering
 *  - defaultGenerator preselects the active generator button
 * Also clear the toolbar badge (the user has seen the captured requests now).
 */
async function applySettings() {
  const settings = await loadSettings();
  redactSecretsOnCopy = settings.redactSecretsOnCopy !== false;
  redactSecretsOnDisplay = settings.redactSecretsOnDisplay === true;
  el.redactToggle.checked = redactSecretsOnCopy;
  if (typeof settings.defaultGenerator === "string" && getGenerator(settings.defaultGenerator)) {
    currentGenerator = settings.defaultGenerator;
  }

  // The user is now looking at the captured list — clear the badge.
  try {
    const action = getBrowser().action || getBrowser().browserAction;
    if (action) action.setBadgeText({ text: "" });
  } catch {
    /* ignore */
  }
}

void (async () => {
  renderLangSelect();
  renderStatusPills();
  await applySettings();
  await loadRequests();
})();
