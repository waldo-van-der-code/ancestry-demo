// Privacy gate for the public repo: the published code, data and built site must contain no real family data.
//
// The real names live in a private denylist file OUTSIDE this repo (the public repo cannot contain them).
// Point PRIVACY_DENYLIST at that JSON file ({ protected, surnames, fullNames, ids, commonWords }) to run the check;
// without it the test is skipped so everyone else's `npm test` still passes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const listFile = process.env.PRIVACY_DENYLIST;

// The public GitHub account that hosts this repo is intended to be visible; it is removed before scanning.
const PUBLIC_ACCOUNT = ["wal", "do-van-der-code"].join("");
// The author's name may appear only in these files, as the full author name (copyright line / author line).
const AUTHOR = ["Wal", "do Vander", "haeghen"].join(""); // built from parts so this file itself stays clean
const AUTHOR_FILES = new Set(["LICENSE", "README.md"]);
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|map)$/i;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const walk = (d) => (fs.statSync(d).isDirectory() ? fs.readdirSync(d).flatMap((x) => walk(path.join(d, x))) : [d]);

function repoFiles() {
  let names;
  try {
    names = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    names = walk(ROOT).map((f) => path.relative(ROOT, f)).filter((f) => !f.startsWith("node_modules") && !f.startsWith(".git/"));
  }
  const built = fs.existsSync(path.join(ROOT, "dist")) ? walk(path.join(ROOT, "dist")).map((f) => path.relative(ROOT, f)) : [];
  return [...new Set([...names, ...built])].filter((f) => fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).isFile());
}

function scan(list) {
  // Words in the private denylist that are also ordinary words (or CSS/HTML vocabulary) would flood the scan with
  // false positives, so they are only checked inside data/. The list is `commonWords` in the denylist file.
  const COMMON_WORDS = new Set(list.commonWords || []);
  // One combined regex per category keeps the scan fast (thousands of names x every file).
  const alt = (xs) => xs.map(esc).sort((a, b) => b.length - a.length).join("|");
  const protectedRe = new RegExp(`(?<![\\p{L}\\p{N}])(${alt(list.protected)})(?![\\p{L}\\p{N}])`, "giu");
  const surRe = new RegExp(`\\b(${alt(list.surnames)})\\b`, "g");
  const fullRe = new RegExp(`(${alt(list.fullNames)})`, "g");
  const idRe = new RegExp(`(?<![a-z0-9-])(${alt(list.ids)})(?![a-z0-9-])`, "g");
  const problems = [];
  for (const f of repoFiles()) {
    const isData = f.startsWith("data/");
    const texts = [{ what: "filename", s: f }];
    if (!BINARY.test(f)) {
      let s = fs.readFileSync(path.join(ROOT, f), "utf8").split(PUBLIC_ACCOUNT).join("");
      if (AUTHOR_FILES.has(f)) s = s.split(AUTHOR).join("");
      texts.push({ what: "content", s });
    }
    for (const { what, s } of texts) {
      for (const m of s.matchAll(protectedRe)) problems.push(`${f}: forbidden name (${m[1]}) in ${what}`);
      for (const m of s.matchAll(surRe)) if (isData || !COMMON_WORDS.has(m[1])) problems.push(`${f}: forbidden real surname (${m[1]}) in ${what}`);
      for (const m of s.matchAll(fullRe)) problems.push(`${f}: forbidden real full name (${m[1]}) in ${what}`);
      for (const m of s.matchAll(idRe)) problems.push(`${f}: forbidden real person id (${m[1]}) in ${what}`);
    }
  }
  return [...new Set(problems)];
}

test("no real surnames, full names, ids, hosts or tracking code in the repo or the built site", { skip: listFile ? false : "set PRIVACY_DENYLIST to the private denylist JSON to run this check" }, () => {
  const list = JSON.parse(fs.readFileSync(listFile, "utf8"));
  assert.ok(list.surnames.length > 100 && list.fullNames.length > 100 && list.protected.length > 5, "denylist looks empty or truncated");
  assert.ok(!(list.commonWords || []).some((n) => list.protected.some((p) => p.toLowerCase() === n.toLowerCase())), "a protected name must never be allowlisted");
  const problems = scan(list);
  assert.deepEqual(problems.slice(0, Number(process.env.PRIVACY_MAX || 20)), [], `${problems.length} privacy problems`);
});

test("no words from the private hint list in the repo or the built site", { skip: listFile ? false : "set PRIVACY_DENYLIST to the private denylist JSON to run this check" }, () => {
  const hints = JSON.parse(fs.readFileSync(listFile, "utf8")).hints || [];
  assert.ok(hints.length > 5, "hint list missing from the denylist");
  const re = new RegExp(hints.map(esc).join("|"), "i");
  const dist = fs.existsSync(path.join(ROOT, "dist")) ? walk(path.join(ROOT, "dist")) : [];
  const files = [...repoFiles().map((f) => path.join(ROOT, f)), ...dist].filter((f) => !BINARY.test(f) && !/[\\/]vendor[\\/]/.test(f));
  const hits = files.flatMap((f) => { const m = re.exec(fs.readFileSync(f, "utf8")); return m ? [`${path.relative(ROOT, f)}: ${m[0]}`] : []; });
  assert.deepEqual(hits, []);
});

test("the demo build output has no third-party tracking, password forms or /api/ calls", { skip: fs.existsSync(path.join(ROOT, "dist")) ? false : "dist/ not built" }, () => {
  const bad = new RegExp([["post", "hog"].join(""), "googletagmanager", "google-analytics", "type=[\"']?password", "/api/"].join("|"), "i");
  const hits = walk(path.join(ROOT, "dist")).filter((f) => !BINARY.test(f) && bad.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(hits.map((f) => path.relative(ROOT, f)), []);
});
