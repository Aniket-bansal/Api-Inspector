/**
 * Tests covering all 7 code generators (fetch / axios / cURL / Python / Go /
 * Node / HTTPie). Each generator is exercised with: a simple GET, a JSON POST,
 * and a non-JSON POST (regression for the Phase 1 formatBodyLiteral bug).
 *
 * Run with: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { GENERATORS, getGenerator } from "../utils/codegen/index.js";

/** @typedef {{ url?: string, method?: string, headers?: Array<{name:string,value:string}>, body?: string|null }} Req */

const simpleGet = /** @type {Req} */ ({
  url: "https://api.example.com/users/42",
  method: "GET",
  headers: [{ name: "Accept", value: "application/json" }],
});

const jsonPost = /** @type {Req} */ ({
  url: "https://api.example.com/users",
  method: "POST",
  headers: [{ name: "Content-Type", value: "application/json" }],
  body: '{"name":"John","email":"john@example.com"}',
});

const plainPost = /** @type {Req} */ ({
  url: "https://api.example.com/echo",
  method: "POST",
  headers: [{ name: "Content-Type", value: "text/plain" }],
  body: "line1\nline2",
});

// ---------------------------------------------------------------------------
// Registry sanity
// ---------------------------------------------------------------------------

test("registry: exposes 7 generators with stable ids", () => {
  const ids = GENERATORS.map((g) => g.id);
  assert.deepEqual(ids, ["fetch", "axios", "curl", "python", "go", "node", "httpie"]);
  for (const g of GENERATORS) {
    assert.equal(typeof g.generate, "function", `${g.id} has a generate fn`);
    assert.equal(typeof g.label, "string", `${g.id} has a label`);
  }
});

test("registry: getGenerator returns the matching generator", () => {
  assert.equal(getGenerator("python")?.id, "python");
  assert.equal(getGenerator("does-not-exist"), undefined);
});

// ---------------------------------------------------------------------------
// Per-generator smoke tests. We assert a few key fragments per generator
// rather than snapshotting the entire output — that keeps the tests robust
// to minor formatting changes.
// ---------------------------------------------------------------------------

test("fetch: GET, headers, no body", () => {
  const out = getGenerator("fetch")?.generate(simpleGet) ?? "";
  assert.match(out, /fetch\('https:\/\/api\.example\.com\/users\/42'/);
  assert.match(out, /method: 'GET'/);
  assert.match(out, /'Accept': 'application\/json'/);
  assert.doesNotMatch(out, /body:/);
});

test("fetch: POST with JSON body uses JSON.stringify", () => {
  const out = getGenerator("fetch")?.generate(jsonPost) ?? "";
  assert.match(out, /body: JSON\.stringify\(/);
  assert.match(out, /"name": "John"/);
});

test("fetch: non-JSON POST body becomes an escaped JS string literal (regression)", () => {
  const out = getGenerator("fetch")?.generate(plainPost) ?? "";
  assert.match(out, /body: 'line1\\nline2'/);
});

test("axios: lowercase method + url", () => {
  const out = getGenerator("axios")?.generate(simpleGet) ?? "";
  assert.match(out, /method: 'get'/);
  assert.match(out, /url: 'https:\/\/api\.example\.com\/users\/42'/);
});

test("axios: JSON POST emits object-literal data", () => {
  const out = getGenerator("axios")?.generate(jsonPost) ?? "";
  assert.match(out, /data: \{/);
  assert.match(out, /"name": "John"/);
});

test("axios: non-JSON POST data is an escaped string literal", () => {
  const out = getGenerator("axios")?.generate(plainPost) ?? "";
  assert.match(out, /data: 'line1\\nline2'/);
});

test("curl: method flag, url, header args, --data-raw", () => {
  const out = getGenerator("curl")?.generate(jsonPost) ?? "";
  assert.match(out, /^curl -X POST/);
  assert.match(out, /-H 'Content-Type: application\/json'/);
  assert.match(out, /--data-raw/);
});

test("curl: bare GET collapses to single line", () => {
  const out = getGenerator("curl")?.generate({ url: "https://x.example.com/", method: "GET" });
  assert.equal(out, "curl -X GET 'https://x.example.com/'");
});

test("curl: escapes embedded single quotes in bash", () => {
  const out = getGenerator("curl")?.generate({ url: "https://x/?q=it's", method: "GET" }) ?? "";
  assert.match(out, /'https:\/\/x\/\?q=it'\\''s'/);
});

test("python: emits import + requests.request call", () => {
  const out = getGenerator("python")?.generate(jsonPost) ?? "";
  assert.match(out, /^import requests/);
  assert.match(out, /requests\.request\(/);
  assert.match(out, /"POST"/);
  assert.match(out, /"name": "John"/);
});

test("python: GET request without body omits json/data args", () => {
  const out = getGenerator("python")?.generate(simpleGet) ?? "";
  assert.match(out, /requests\.request\(/);
  assert.doesNotMatch(out, /\bjson=/);
  assert.doesNotMatch(out, /\bdata=/);
});

test("python: non-JSON POST body is a triple-quoted string", () => {
  const out = getGenerator("python")?.generate(plainPost) ?? "";
  assert.match(out, /body\s*=\s*'''/);
  assert.match(out, /data=body/);
});

test("go: emits a runnable main package", () => {
  const out = getGenerator("go")?.generate(jsonPost) ?? "";
  assert.match(out, /^package main/);
  assert.match(out, /"net\/http"/);
  assert.match(out, /http\.NewRequest\(/);
  assert.match(out, /bytes\.NewReader\(body\)/);
  assert.match(out, /fmt\.Println\(resp\.Status\)/);
});

test("go: GET request uses nil body, no bytes import", () => {
  const out = getGenerator("go")?.generate(simpleGet) ?? "";
  assert.match(out, /http\.NewRequest\("GET", "[^"]+", nil\)/);
  assert.doesNotMatch(out, /bytes\.NewReader/);
  assert.doesNotMatch(out, /"bytes"/);
});

test("node: emits import + got() call", () => {
  const out = getGenerator("node")?.generate(jsonPost) ?? "";
  assert.match(out, /^import got from "got";/);
  assert.match(out, /await got\(/);
  assert.match(out, /method: "POST"/);
});

test("node: JSON POST uses got's json option", () => {
  const out = getGenerator("node")?.generate(jsonPost) ?? "";
  assert.match(out, /json: \{/);
});

test("httpie: method flag, url, header: value pairs", () => {
  const out = getGenerator("httpie")?.generate(jsonPost) ?? "";
  assert.match(out, /^http POST/);
  assert.match(out, /Content-Type:application\/json/);
});

test("httpie: JSON POST body becomes key:=value pairs", () => {
  const out = getGenerator("httpie")?.generate(jsonPost) ?? "";
  assert.match(out, /name:="John"/);
  assert.match(out, /email:="john@example.com"/);
});

test("httpie: non-JSON POST body uses --raw", () => {
  const out = getGenerator("httpie")?.generate(plainPost) ?? "";
  assert.match(out, /--raw/);
});

// ---------------------------------------------------------------------------
// Redaction (applies to all generators uniformly via the shared prepareRequest)
// ---------------------------------------------------------------------------

test("all generators: redactSecrets masks Authorization across the board", () => {
  const req = /** @type {Req} */ ({
    url: "https://x.example.com/",
    method: "GET",
    headers: [{ name: "Authorization", value: "Bearer abc.def.ghi" }],
  });
  for (const g of GENERATORS) {
    const out = g.generate(req, { redactSecrets: true });
    assert.match(
      out,
      /Bearer <redacted>/,
      `generator ${g.id} should mask Authorization with redactSecrets=true`
    );
  }
});

test("all generators: redactSecrets=false leaves secrets intact", () => {
  const req = /** @type {Req} */ ({
    url: "https://x.example.com/",
    method: "GET",
    headers: [{ name: "Authorization", value: "Bearer abc.def.ghi" }],
  });
  for (const g of GENERATORS) {
    const out = g.generate(req, { redactSecrets: false });
    assert.doesNotMatch(out, /<redacted>/, `generator ${g.id} should NOT redact`);
    assert.match(out, /abc\.def\.ghi/, `generator ${g.id} should keep the original value`);
  }
});

// ---------------------------------------------------------------------------
// Forbidden-header stripping
// ---------------------------------------------------------------------------

test("all generators: strip forbidden headers (Host, Content-Length)", () => {
  const req = /** @type {Req} */ ({
    url: "https://x.example.com/",
    method: "GET",
    headers: [
      { name: "Host", value: "x.example.com" },
      { name: "Content-Length", value: "0" },
      { name: "X-Custom", value: "keep-me" },
    ],
  });
  for (const g of GENERATORS) {
    const out = g.generate(req);
    assert.doesNotMatch(out, /Content-Length/, `${g.id}: Content-Length leaked`);
    assert.doesNotMatch(out, /\bHost:/, `${g.id}: Host leaked`);
    assert.match(out, /X-Custom/, `${g.id}: X-Custom should be kept`);
  }
});
