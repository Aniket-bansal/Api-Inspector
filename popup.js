/**
 * Popup UI: list captured requests, show details, generate & copy code.
 */

import { storageLocal } from "./utils/browser.js";
import { generateAxios, generateCurl, generateFetch } from "./utils/codegen.js";

const STORAGE_KEY = "capturedRequests";

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
  btnBack: document.getElementById("btn-back"),
  detailMethod: document.getElementById("detail-method"),
  detailUrl: document.getElementById("detail-url"),
  detailHeaders: document.getElementById("detail-headers"),
  detailBody: document.getElementById("detail-body"),
  btnFetch: document.getElementById("btn-fetch"),
  btnAxios: document.getElementById("btn-axios"),
  btnCurl: document.getElementById("btn-curl"),
  codeOutput: document.getElementById("code-output"),
  btnCopy: document.getElementById("btn-copy"),
};

/** @type {any[]} */
let requests = [];
/** @type {any | null} */
let selected = null;

/** @type {string} DevTools-style category id */
let activeFilter = "fetch";
/** @type {string} */
let searchQuery = "";

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
 * @returns {any[]}
 */
function getVisibleRequests() {
  const q = searchQuery.trim().toLowerCase();
  return requests.filter((req) => {
    if (activeFilter !== "all" && getPrimaryCategory(req) !== activeFilter) return false;
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
  el.codeOutput.value = "";
}

function showDetail(req) {
  selected = req;
  el.viewList.classList.add("hidden");
  el.viewDetail.classList.remove("hidden");

  el.detailMethod.textContent = req.method || "";
  el.detailUrl.textContent = req.url || "";
  el.detailHeaders.textContent = formatHeaders(req.headers);
  el.detailBody.textContent = req.body != null && req.body !== "" ? req.body : "—";
  el.codeOutput.value = "";
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
    const data = await storageLocal.get(STORAGE_KEY);
    requests = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  } catch (e) {
    console.error(e);
    requests = [];
    setStatus("Could not read storage.", true);
  }
  renderFilterPills();
  renderList();
}

async function clearAll() {
  try {
    await storageLocal.set({ [STORAGE_KEY]: [] });
    requests = [];
    renderFilterPills();
    renderList();
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

  el.emptyHint.classList.toggle("hidden", !emptyStore);
  el.emptyFilterHint.classList.toggle("hidden", !emptyFiltered);

  for (const req of visible) {
    const li = document.createElement("li");
    li.className = "request-item";
    const cat = getPrimaryCategory(req);
    li.innerHTML = `
      <span class="method-badge">${escapeHtml(req.method || "?")}</span>
      <span class="type-pill" title="Resource type">${escapeHtml(cat)}</span>
      <span class="request-url" title="${escapeAttr(req.url)}">${escapeHtml(truncateUrl(req.url, 56))}</span>
    `;
    li.addEventListener("click", () => showDetail(req));
    el.list.appendChild(li);
  }
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
  void clearAll();
});

el.btnFetch.addEventListener("click", () => {
  if (!selected) return;
  try {
    el.codeOutput.value = generateFetch(selected);
    setStatus("Fetch snippet generated.");
  } catch (e) {
    console.error(e);
    setStatus("Codegen failed.", true);
  }
});

el.btnAxios.addEventListener("click", () => {
  if (!selected) return;
  try {
    el.codeOutput.value = generateAxios(selected);
    setStatus("Axios snippet generated.");
  } catch (e) {
    console.error(e);
    setStatus("Codegen failed.", true);
  }
});

el.btnCurl.addEventListener("click", () => {
  if (!selected) return;
  try {
    el.codeOutput.value = generateCurl(selected);
    setStatus("cURL command generated.");
  } catch (e) {
    console.error(e);
    setStatus("Codegen failed.", true);
  }
});

el.btnCopy.addEventListener("click", () => void copyCode());

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

void loadRequests();
