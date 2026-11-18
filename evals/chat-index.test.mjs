// The committed chat index is exactly what a fresh build produces, and it never carries details of living people.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { raw } from "./chat-helpers.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

test("a fresh build reproduces api/_chat/demo.json and api/_lib/kinship.mjs byte for byte", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "chat-index-"));
  try {
    execFileSync("node", ["-e", `import("${ROOT}/scripts/chat-index.mjs").then(m => m.writeChatIndex({ apiDir: ${JSON.stringify(out)} }))`], { cwd: ROOT, stdio: "pipe" });
    for (const f of ["_chat/demo.json", "_lib/kinship.mjs"]) {
      assert.ok(fs.readFileSync(path.join(out, f)).equals(fs.readFileSync(path.join(ROOT, "api", f))), `${f} is stale: run npm run build and commit it`);
    }
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test("living people have a name and at most a birth year: no residences, story, sources or full dates", () => {
  const living = raw.p.filter((p) => p.l);
  assert.ok(living.length > 0);
  for (const p of living) {
    for (const k of ["res", "st", "occ", "src", "conf", "bp", "d", "dp", "dy"]) assert.equal(p[k], undefined, `${p.id}.${k}`);
    if (p.b !== undefined) assert.match(String(p.b), /^\d{4}$/, p.id);
    for (const s of p.sp || []) if (s.md) assert.match(String(s.md), /^\d{4}$/);
  }
  // and no chunk points at a living person's page
  const ids = new Set(living.map((p) => p.id));
  for (const c of raw.c) {
    if (c.r) assert.ok(!ids.has(raw.p[c.r[0]].id));
    else assert.ok(![...ids].some((id) => c.u.includes(`/${id}/`)));
  }
});

test("chunk and person paths carry no site base", () => {
  for (const c of raw.c) if (c.u) assert.match(c.u, /^\/(nl|en)\//);
});

test("the index is small", () => assert.ok(fs.statSync(path.join(ROOT, "api/_chat/demo.json")).size < 3 * 1024 * 1024));

test("a living person with a birth place, occupation and sources keeps none of them (README: name, family links, birth year)", async () => {
  const { personRow } = await import("../scripts/chat-index.mjs");
  const row = { id: "x", n: "Test Person", b: "1990-05-01", by: 1990, bp: "Sluis", d: null, dp: null, f: "a", m: "b", sp: [{ id: "c", md: "2015-06-01" }], l: 1 };
  const p = personRow(row, { occupation: "baker", confidence: "documented", sources: [{ doc: "civil" }], residences: [{ place: "Sluis" }] });
  for (const k of ["bp", "occ", "conf", "src", "res", "d", "dp", "dy"]) assert.equal(p[k], undefined, k);
  assert.equal(p.b, "1990");
  assert.equal(p.sp[0].md, "2015");
  assert.equal(p.f, "a");
});
