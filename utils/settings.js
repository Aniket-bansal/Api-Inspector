/**
 * User-tunable settings.
 *
 * Stored under `storage.local[SETTINGS_KEY]` as a partial object; merged with
 * `DEFAULT_SETTINGS` on read. The Phase 5 options page writes here; the popup
 * reads here to decide redaction defaults, default generator, etc.
 *
 * NOTE: settings are read on demand (not cached) so changes from the options
 * page are picked up immediately by other extension surfaces.
 */

import { storageLocal } from "./browser.js";
import { SETTINGS_KEY } from "./config.js";

/**
 * @typedef {Object} Settings
 * @property {boolean} redactSecretsOnCopy     Mask secret headers in generated snippets (default ON — safer for sharing).
 * @property {boolean} redactSecretsOnDisplay  Mask secret headers in the popup detail view (default OFF — user's own traffic).
 * @property {boolean} showBadge               Show a toolbar badge with the number of captured requests.
 * @property {number}  maxStored               How many captured requests to keep in storage.
 * @property {number}  maxBodyChars            Hard character cap for any single stored request/response body.
 * @property {string}  defaultGenerator        Generator id selected by default in the popup dropdown.
 * @property {string[]} enabledGenerators      Generator ids that appear in the popup dropdown.
 * @property {string}  theme                   "dark" | "light" | "system"
 */

/** @type {Readonly<Settings>} */
export const DEFAULT_SETTINGS = Object.freeze({
  redactSecretsOnCopy: true,
  redactSecretsOnDisplay: false,
  showBadge: true,
  maxStored: 50,
  maxBodyChars: 100_000,
  defaultGenerator: "fetch",
  enabledGenerators: Object.freeze(["fetch", "axios", "curl", "python", "go", "node", "httpie"]),
  theme: "dark",
});

/**
 * Load the current settings, merged with defaults for any missing keys.
 *
 * @returns {Promise<Settings>}
 */
export async function loadSettings() {
  try {
    const data = await storageLocal.get(SETTINGS_KEY);
    const stored = data && typeof data[SETTINGS_KEY] === "object" ? data[SETTINGS_KEY] : {};
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch (e) {
    console.error("[api-inspector] settings load error", e);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persist settings. Caller should pass a full Settings object (use
 * `loadSettings()` first, mutate, then `saveSettings()`).
 *
 * @param {Settings} settings
 */
export async function saveSettings(settings) {
  await storageLocal.set({ [SETTINGS_KEY]: settings });
}

/**
 * Apply a partial update on top of the currently-stored settings.
 *
 * @param {Partial<Settings>} patch
 * @returns {Promise<Settings>} the merged settings after writing
 */
export async function updateSettings(patch) {
  const current = await loadSettings();
  const next = { ...current, ...patch };
  await saveSettings(next);
  return next;
}
