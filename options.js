/**
 * Options page logic: load settings, render generator checkboxes, save on
 * submit. Everything is written to storage.local[SETTINGS_KEY]; the popup and
 * background service worker read from the same location.
 */

import { GENERATORS } from "./utils/codegen/index.js";
import { loadSettings, saveSettings } from "./utils/settings.js";

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const el = {
  form: $("options-form"),
  redactSecretsOnCopy: $("redactSecretsOnCopy"),
  redactSecretsOnDisplay: $("redactSecretsOnDisplay"),
  maxStored: $("maxStored"),
  maxStoredOut: $("maxStored-out"),
  maxBodyChars: $("maxBodyChars"),
  maxBodyCharsOut: $("maxBodyChars-out"),
  showBadge: $("showBadge"),
  enabledGenerators: $("enabled-generators"),
  defaultGenerator: $("defaultGenerator"),
  theme: $("theme"),
  btnSave: $("btn-save"),
  status: $("status"),
};

/** @type {string[]} generator ids that are currently checked. */
let enabledSet = [];

/**
 * Render the enabled-generators fieldset + the default-generator dropdown.
 * Called once on boot.
 */
function renderGenerators(settings) {
  // Checkboxes
  el.enabledGenerators.innerHTML = "";
  enabledSet = settings.enabledGenerators.slice();
  for (const g of GENERATORS) {
    const id = `gen-${g.id}`;
    const row = document.createElement("div");
    row.className = "check-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = id;
    cb.value = g.id;
    cb.checked = enabledSet.includes(g.id);
    cb.addEventListener("change", () => {
      const idx = enabledSet.indexOf(g.id);
      if (cb.checked && idx === -1) enabledSet.push(g.id);
      if (!cb.checked && idx !== -1) enabledSet.splice(idx, 1);
      renderDefaultOptions();
    });
    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.textContent = g.label;
    row.appendChild(cb);
    row.appendChild(label);
    el.enabledGenerators.appendChild(row);
  }
  renderDefaultOptions();
}

/**
 * Re-populate the default-generator dropdown with the currently-enabled
 * generators, preserving the current selection if possible.
 */
function renderDefaultOptions() {
  const previous = el.defaultGenerator.value;
  el.defaultGenerator.innerHTML = "";
  for (const g of GENERATORS) {
    if (!enabledSet.includes(g.id)) continue;
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.label;
    el.defaultGenerator.appendChild(opt);
  }
  if (enabledSet.includes(previous)) {
    el.defaultGenerator.value = previous;
  } else if (el.defaultGenerator.options.length > 0) {
    el.defaultGenerator.value = el.defaultGenerator.options[0].value;
  }
}

/**
 * Apply a loaded settings object to the form fields.
 */
function applySettings(settings) {
  el.redactSecretsOnCopy.checked = settings.redactSecretsOnCopy !== false;
  el.redactSecretsOnDisplay.checked = settings.redactSecretsOnDisplay === true;
  el.maxStored.value = String(settings.maxStored ?? 50);
  el.maxStoredOut.textContent = `${el.maxStored.value}`;
  el.maxBodyChars.value = String(settings.maxBodyChars ?? 100_000);
  el.maxBodyCharsOut.textContent = formatThousands(Number(el.maxBodyChars.value));
  el.showBadge.checked = settings.showBadge !== false;
  el.theme.value = settings.theme || "dark";
  renderGenerators(settings);
  el.defaultGenerator.value = settings.defaultGenerator || "fetch";
  applyTheme(settings.theme || "dark");
}

/**
 * Read the form fields into a Settings object (full, not partial).
 */
function collectSettings() {
  return {
    redactSecretsOnCopy: el.redactSecretsOnCopy.checked,
    redactSecretsOnDisplay: el.redactSecretsOnDisplay.checked,
    maxStored: Number(el.maxStored.value),
    maxBodyChars: Number(el.maxBodyChars.value),
    showBadge: el.showBadge.checked,
    defaultGenerator: el.defaultGenerator.value,
    enabledGenerators: enabledSet.slice(),
    theme: el.theme.value,
  };
}

/** @param {number} n */
function formatThousands(n) {
  return n.toLocaleString("en-US");
}

/** @param {string} theme */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

el.maxStored.addEventListener("input", () => {
  el.maxStoredOut.textContent = el.maxStored.value;
});
el.maxBodyChars.addEventListener("input", () => {
  el.maxBodyCharsOut.textContent = formatThousands(Number(el.maxBodyChars.value));
});

el.theme.addEventListener("change", () => {
  applyTheme(el.theme.value);
});

el.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  el.btnSave.disabled = true;
  try {
    const settings = collectSettings();
    if (settings.enabledGenerators.length === 0) {
      el.status.textContent = "Pick at least one generator.";
      el.status.classList.add("status-error");
      return;
    }
    await saveSettings(settings);
    el.status.classList.remove("status-error");
    el.status.textContent = "Saved.";
  } catch (err) {
    console.error(err);
    el.status.classList.add("status-error");
    el.status.textContent = "Save failed.";
  } finally {
    el.btnSave.disabled = false;
    setTimeout(() => {
      el.status.textContent = "";
    }, 2500);
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

void (async () => {
  // Apply theme as early as possible to avoid a flash of wrong colors.
  try {
    const initial = await loadSettings();
    applySettings(initial);
  } catch (err) {
    console.error(err);
  }
})();
