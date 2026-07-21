/**
 * Tests for the shared text helpers in utils/text.js.
 * Run with: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  truncate,
  escapeSingleQuoted,
  escapeBashSingleQuoted,
  escapeHtml,
  escapeAttr,
  formatBodyLiteral,
  guessBodyType,
} from "../utils/text.js";

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

test("truncate returns short strings unchanged", () => {
  assert.equal(truncate("hello", 100), "hello");
});

test("truncate cuts long strings and appends the marker", () => {
  const input = "x".repeat(250);
  const out = truncate(input, 100);
  assert.equal(out.length, 100 + "\n/* …truncated… */".length);
  assert.equal(out.slice(0, 100), "x".repeat(100));
  assert.match(out, /…truncated…/);
});

test("truncate returns non-strings untouched", () => {
  assert.equal(truncate(/** @type {any} */ (42), 5), 42);
});

// ---------------------------------------------------------------------------
// escapeSingleQuoted
// ---------------------------------------------------------------------------

test("escapeSingleQuoted escapes backslashes, quotes, CR, LF", () => {
  assert.equal(escapeSingleQuoted("a'b\\c\r\nd"), "a\\'b\\\\c\\r\\nd");
});

test("escapeSingleQuoted coerces non-strings", () => {
  assert.equal(escapeSingleQuoted(/** @type {any} */ (5)), "5");
});

// ---------------------------------------------------------------------------
// escapeBashSingleQuoted
// ---------------------------------------------------------------------------

test("escapeBashSingleQuoted wraps a plain string in single quotes", () => {
  assert.equal(escapeBashSingleQuoted("hello"), "'hello'");
});

test("escapeBashSingleQuoted closes & reopens quotes around an embedded quote", () => {
  assert.equal(escapeBashSingleQuoted("a'b"), "'a'\\''b'");
});

// ---------------------------------------------------------------------------
// escapeHtml / escapeAttr
// ---------------------------------------------------------------------------

test("escapeHtml escapes the four essential characters", () => {
  assert.equal(escapeHtml(`<a href="x">&</a>`), `&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;`);
});

test("escapeAttr additionally escapes single quotes", () => {
  assert.equal(escapeAttr(`it's <b>`), "it&#39;s &lt;b&gt;");
});

// ---------------------------------------------------------------------------
// formatBodyLiteral
// ---------------------------------------------------------------------------

test("formatBodyLiteral pretty-prints valid JSON", () => {
  assert.equal(formatBodyLiteral('{"a":1,"b":2}'), '{\n  "a": 1,\n  "b": 2\n}');
});

test("formatBodyLiteral returns the raw string when input is not JSON", () => {
  // NOTE: this is the corrected behaviour; the legacy codegen.js version
  // double-encodes via JSON.stringify. Phase 1 will swap codegen over to this.
  assert.equal(formatBodyLiteral("plain text"), "plain text");
});

test("formatBodyLiteral returns the literal 'null' for empty input", () => {
  assert.equal(formatBodyLiteral(""), "null");
  assert.equal(formatBodyLiteral(null), "null");
});

// ---------------------------------------------------------------------------
// guessBodyType
// ---------------------------------------------------------------------------

test("guessBodyType detects JSON objects and arrays", () => {
  assert.equal(guessBodyType('{"x":1}'), "application/json");
  assert.equal(guessBodyType("[1,2,3]"), "application/json");
});

test("guessBodyType falls back to text/plain for malformed JSON", () => {
  assert.equal(guessBodyType("{not json}"), "text/plain");
  assert.equal(guessBodyType("hello"), "text/plain");
  assert.equal(guessBodyType(""), "text/plain");
});
