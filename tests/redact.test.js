/**
 * Tests for utils/redact.js — secret-header detection + masking.
 * Run with: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { isSecretHeader, redactHeaderValue, maskSecretsInHeaders } from "../utils/redact.js";

// ---------------------------------------------------------------------------
// isSecretHeader
// ---------------------------------------------------------------------------

test("isSecretHeader: recognises Authorization, Cookie, etc.", () => {
  assert.equal(isSecretHeader("Authorization"), true);
  assert.equal(isSecretHeader("authorization"), true);
  assert.equal(isSecretHeader("AUTHORIZATION"), true);
  assert.equal(isSecretHeader("Cookie"), true);
  assert.equal(isSecretHeader("Set-Cookie"), true);
  assert.equal(isSecretHeader("X-API-Key"), true);
});

test("isSecretHeader: pattern-matches token / secret / api-key", () => {
  assert.equal(isSecretHeader("X-Auth-Token"), true);
  assert.equal(isSecretHeader("X-CSRF-Token"), true);
  assert.equal(isSecretHeader("Client-Secret"), true);
  assert.equal(isSecretHeader("X-Session-Id"), true);
  assert.equal(isSecretHeader("MyApikey"), true); // /api[-_]?key/i substring
});

test("isSecretHeader: leaves innocuous headers alone", () => {
  assert.equal(isSecretHeader("Content-Type"), false);
  assert.equal(isSecretHeader("Accept"), false);
  assert.equal(isSecretHeader("User-Agent"), false);
  assert.equal(isSecretHeader("X-Request-Id"), false);
  assert.equal(isSecretHeader(""), false);
  assert.equal(isSecretHeader(undefined), false);
});

// ---------------------------------------------------------------------------
// redactHeaderValue
// ---------------------------------------------------------------------------

test("redactHeaderValue: preserves common scheme prefixes (Bearer, Basic)", () => {
  assert.equal(redactHeaderValue("Bearer eyJabc123.longtoken"), "Bearer <redacted>");
  assert.equal(redactHeaderValue("Basic dXNlcjpwYXNz"), "Basic <redacted>");
  assert.equal(redactHeaderValue("Token abcdef123456"), "Token <redacted>");
});

test("redactHeaderValue: redacts short values entirely", () => {
  assert.equal(redactHeaderValue("xyz"), "<redacted>");
  assert.equal(redactHeaderValue("abc123"), "<redacted>");
});

test("redactHeaderValue: keeps first 4 chars of opaque long values", () => {
  assert.equal(redactHeaderValue("abcdef1234567890"), "abcd…<redacted>");
});

test("redactHeaderValue: passes empty/null through", () => {
  assert.equal(redactHeaderValue(""), "");
  assert.equal(redactHeaderValue(null), null);
});

// ---------------------------------------------------------------------------
// maskSecretsInHeaders
// ---------------------------------------------------------------------------

test("maskSecretsInHeaders: redacts secret headers, leaves others alone", () => {
  const out = maskSecretsInHeaders([
    { name: "Authorization", value: "Bearer abc.def.ghi" },
    { name: "Content-Type", value: "application/json" },
    { name: "X-API-Key", value: "sk-live-abcdef123456" },
    { name: "Accept", value: "*/*" },
  ]);
  assert.deepEqual(out, [
    { name: "Authorization", value: "Bearer <redacted>" },
    { name: "Content-Type", value: "application/json" },
    { name: "X-API-Key", value: "sk-l…<redacted>" },
    { name: "Accept", value: "*/*" },
  ]);
});

test("maskSecretsInHeaders: does not mutate the input", () => {
  const original = [{ name: "Authorization", value: "Bearer secret" }];
  const snapshot = JSON.parse(JSON.stringify(original));
  maskSecretsInHeaders(original);
  assert.deepEqual(original, snapshot);
});

test("maskSecretsInHeaders: handles non-array input", () => {
  assert.deepEqual(maskSecretsInHeaders(undefined), []);
  assert.deepEqual(maskSecretsInHeaders(/** @type {any} */ (null)), []);
});
