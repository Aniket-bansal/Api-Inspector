/**
 * Codegen registry. The popup imports `GENERATORS` and `generate()` from here;
 * individual generators live in sibling files.
 */

import { generateFetch } from "./fetch.js";
import { generateAxios } from "./axios.js";
import { generateCurl } from "./curl.js";
import { generatePython } from "./python.js";
import { generateGo } from "./go.js";
import { generateNode } from "./node.js";
import { generateHttpie } from "./httpie.js";

/**
 * @typedef {(req: import("./shared.js").GenRequest, opts?: import("./shared.js").GenOptions) => string} GeneratorFn
 */

/**
 * @typedef {Object} Generator
 * @property {string} id           Stable identifier, stored in settings.
 * @property {string} label        Human-readable label for the dropdown.
 * @property {string} language     Highlight / clipboard hint.
 * @property {GeneratorFn} generate
 */

/** @type {Generator[]} */
export const GENERATORS = Object.freeze([
  { id: "fetch", label: "fetch (JS)", language: "javascript", generate: generateFetch },
  { id: "axios", label: "axios (JS)", language: "javascript", generate: generateAxios },
  { id: "curl", label: "cURL (bash)", language: "bash", generate: generateCurl },
  { id: "python", label: "Python (requests)", language: "python", generate: generatePython },
  { id: "go", label: "Go (net/http)", language: "go", generate: generateGo },
  { id: "node", label: "Node (got)", language: "javascript", generate: generateNode },
  { id: "httpie", label: "HTTPie", language: "bash", generate: generateHttpie },
]);

/**
 * @param {string} id
 * @returns {Generator|undefined}
 */
export function getGenerator(id) {
  return GENERATORS.find((g) => g.id === id);
}

// Re-export the individual generators for backwards compatibility with tests
// that import them directly.
export {
  generateFetch,
  generateAxios,
  generateCurl,
  generatePython,
  generateGo,
  generateNode,
  generateHttpie,
};
