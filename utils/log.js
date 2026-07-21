/**
 * Tiny tagged logger so every module logs with a consistent prefix.
 *
 * Keeps the console output greppable and lets us flip verbosity in one place
 * later (e.g. via the options page).
 */

import { LOG_PREFIX } from "./config.js";

/** @param {unknown[]} args */
export function log(...args) {
  console.log(LOG_PREFIX, ...args);
}

/** @param {unknown[]} args */
export function warn(...args) {
  console.warn(LOG_PREFIX, ...args);
}

/** @param {unknown[]} args */
export function error(...args) {
  console.error(LOG_PREFIX, ...args);
}
