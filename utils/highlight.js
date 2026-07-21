/**
 * Minimal regex-based syntax highlighter for the code-output panel.
 *
 * Goals:
 *  - Small (no vendored highlight.js dependency)
 *  - Good-enough highlighting for the languages we generate (JS, bash, Python, Go)
 *  - Safe: always HTML-escapes the input first, then re-applies token spans
 *
 * Implementation: per-language we build a single combined regex with named
 * alternatives, so the input is tokenised in a single pass (no risk of a later
 * rule re-matching the contents of an earlier rule's placeholder, which a
 * naive multi-pass replace suffers from).
 *
 * The output is a string of HTML suitable for `innerHTML` on a `<pre>` that
 * sits visually aligned beneath the (transparent) textarea.
 */

import { escapeHtml } from "./text.js";

/**
 * @typedef {{ re: RegExp, kinds: string[] }} CompiledRules
 */

/** @type {Record<string, CompiledRules>} */
const COMPILED = Object.fromEntries(
  Object.entries({
    javascript: [
      { re: /\/\/[^\n]*/, kind: "comment" },
      { re: /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/, kind: "string" },
      {
        re: /\b(?:const|let|var|await|async|function|return|if|else|throw|new|import|from|export|default|class|extends|true|false|null|undefined)\b/,
        kind: "keyword",
      },
      { re: /\b\d+(?:\.\d+)?\b/, kind: "number" },
    ],
    bash: [
      { re: /(?<=^|\s)#[^\n]*/, kind: "comment" },
      { re: /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/, kind: "string" },
      { re: /\B--?[a-zA-Z][a-zA-Z0-9-]*/, kind: "flag" },
      { re: /\b(?:curl|http|httpie|bash|sh)\b/, kind: "fn" },
    ],
    python: [
      { re: /'''[\s\S]*?'''|"""[\s\S]*?"""/, kind: "string" },
      { re: /(?<=^|\s)#[^\n]*/, kind: "comment" },
      { re: /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/, kind: "string" },
      {
        re: /\b(?:import|from|def|class|return|if|elif|else|for|while|try|except|finally|with|as|in|not|and|or|is|None|True|False|lambda|print|raise|pass|break|continue)\b/,
        kind: "keyword",
      },
      { re: /\b\d+(?:\.\d+)?\b/, kind: "number" },
    ],
    go: [
      { re: /\/\/[^\n]*/, kind: "comment" },
      { re: /"(?:\\.|[^"\\])*"|`[^`]*`/, kind: "string" },
      {
        re: /\b(?:package|import|func|return|if|else|for|range|var|const|type|struct|interface|map|chan|go|defer|nil|true|false)\b/,
        kind: "keyword",
      },
      { re: /\b\d+(?:\.\d+)?\b/, kind: "number" },
    ],
  }).map(([lang, rules]) => {
    // Combine into a single regex with one capturing group per alternative,
    // so we can find which rule fired by checking which group matched.
    const parts = rules.map((r) => `(${r.re.source})`);
    const combined = new RegExp(parts.join("|"), "g");
    return [lang, { re: combined, kinds: rules.map((r) => r.kind) }];
  })
);

/**
 * Highlight `code` for the given language. Returns HTML (with `<span>` tags)
 * suitable for `innerHTML`. Always escapes the input first.
 *
 * Unknown languages fall back to plain escaped text.
 *
 * @param {string} code
 * @param {string} language  One of: javascript, bash, python, go
 * @returns {string}
 */
export function highlight(code, language) {
  const escaped = escapeHtml(code ?? "");
  const compiled = COMPILED[language];
  if (!compiled) return escaped;

  // Reset state, then walk matches. Slices between matches are emitted plain.
  compiled.re.lastIndex = 0;
  let out = "";
  let lastIdx = 0;
  let m;

  while ((m = compiled.re.exec(escaped)) !== null) {
    // Append any unmatched text between the previous match and this one.
    if (m.index > lastIdx) out += escaped.slice(lastIdx, m.index);

    // Find which alternative fired (group 1, 2, 3, …). Group 0 is the whole match.
    let kind = null;
    for (let i = 1; i < m.length; i++) {
      if (m[i] !== undefined) {
        kind = compiled.kinds[i - 1];
        break;
      }
    }

    out += kind ? `<span class="tok-${kind}">${m[0]}</span>` : m[0];

    lastIdx = compiled.re.lastIndex;

    // Zero-width safety (shouldn't happen with our patterns but just in case).
    if (compiled.re.lastIndex === m.index) compiled.re.lastIndex++;
  }

  if (lastIdx < escaped.length) out += escaped.slice(lastIdx);
  return out;
}
