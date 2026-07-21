/**
 * Tests for the tiny regex syntax highlighter (utils/highlight.js).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { highlight } from "../utils/highlight.js";

test("highlight: escapes HTML special characters in the input", () => {
  const out = highlight(`<script>alert("x")</script>`, "javascript");
  assert.equal(out, "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});

test("highlight: javascript wraps strings, keywords, numbers in spans", () => {
  const out = highlight("const x = 42;", "javascript");
  assert.match(out, /<span class="tok-keyword">const<\/span>/);
  assert.match(out, /<span class="tok-number">42<\/span>/);
});

test("highlight: bash wraps flags (--data-raw) and strings", () => {
  const out = highlight("curl -X POST 'https://x.example.com/'", "bash");
  assert.match(out, /<span class="tok-fn">curl<\/span>/);
  assert.match(out, /<span class="tok-flag">-X<\/span>/);
  assert.match(out, /<span class="tok-string">'https:\/\/x\.example\.com\/'<\/span>/);
});

test("highlight: python wraps keywords, comments, strings", () => {
  const out = highlight("import requests\n# hi\nx = 'abc'", "python");
  assert.match(out, /<span class="tok-keyword">import<\/span>/);
  assert.match(out, /<span class="tok-comment"># hi<\/span>/);
  assert.match(out, /<span class="tok-string">'abc'<\/span>/);
});

test("highlight: unknown language falls back to plain escaped text", () => {
  const out = highlight("<b>raw</b>", "cobol");
  assert.equal(out, "&lt;b&gt;raw&lt;/b&gt;");
});

test("highlight: tokens are not re-matched (no nested spans)", () => {
  // 'var' is a JS keyword; ensure the "var" inside a string isn't double-tagged.
  const out = highlight("'var x'", "javascript");
  // Should produce exactly one span (for the outer string).
  const matches = out.match(/<span/g) || [];
  assert.equal(matches.length, 1);
});
