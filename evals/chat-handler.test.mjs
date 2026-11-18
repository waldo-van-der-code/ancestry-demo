// api/ask.js: the HTTP edges (method, key, size, JSON) without reaching Groq.
import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import handler from "../api/ask.js";

function call(method, body, headers = {}) {
  const req = Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(body)]), { method, headers: { "content-length": String(body?.length || 0), "content-type": "application/json", ...headers }, socket: { remoteAddress: "203.0.113.9" } });
  const out = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b; } };
  return handler(req, out).then(() => ({ status: out.statusCode, headers: out.headers, json: out.body ? JSON.parse(out.body) : null }));
}
const withKey = async (fn) => { process.env.GROQ_API_KEY = "test-key"; try { return await fn(); } finally { delete process.env.GROQ_API_KEY; } };

test("only POST is allowed", async () => {
  for (const m of ["GET", "PUT", "PATCH", "DELETE"]) {
    const r = await call(m);
    assert.equal(r.status, 405, m);
    assert.equal(r.headers.allow, "POST");
  }
});

test("without GROQ_API_KEY the answer is 503 not configured", async () => {
  delete process.env.GROQ_API_KEY;
  const r = await call("POST", JSON.stringify({ q: "hi", lang: "en" }));
  assert.equal(r.status, 503);
  assert.deepEqual(r.json, { error: "not configured" });
});

test("oversized, non-JSON and invalid bodies are refused before any model call", () => withKey(async () => {
  assert.equal((await call("POST", "x".repeat(9000))).status, 413);
  assert.equal((await call("POST", "not json")).status, 400);
  assert.equal((await call("POST", JSON.stringify({ q: "hi", lang: "en", extra: 1 }))).status, 400);
}));

test("another site's page cannot spend the quota: cross-origin and non-JSON POSTs are refused", () => withKey(async () => {
  const body = JSON.stringify({ q: "hi", lang: "en" });
  const cross = await call("POST", body, { host: "tree.example", origin: "https://evil.example", "content-type": "application/json" });
  assert.equal(cross.status, 403);
  const plain = await call("POST", body, { host: "tree.example", origin: "https://tree.example", "content-type": "text/plain" });
  assert.equal(plain.status, 415);
}));
