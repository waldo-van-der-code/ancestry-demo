// every occupation in the data maps to a job in data/occupations.json (a new term would silently drop out of the Weetjes page).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { splitTerms, jobsFacts } from "../scripts/facts.mjs";

const dict = JSON.parse(fs.readFileSync(new URL("../data/occupations.json", import.meta.url), "utf8"));

test("every job points to a known group, every term to a known job", () => {
  for (const [j, v] of Object.entries(dict.jobs)) assert.ok(dict.groups[v.g], j);
  for (const [t, j] of Object.entries(dict.terms)) assert.ok(j === null || dict.jobs[j], t);
});

test("splitTerms splits lists, drops years and parentheses", () => {
  assert.deepEqual(splitTerms("koopman (1812)"), ["koopman"]);
  assert.deepEqual(splitTerms("winkelier en wijnknecht"), ["winkelier", "wijnknecht"]);
  assert.deepEqual(splitTerms("(hoef)smid"), ["smid"]);
  assert.deepEqual(splitTerms("Arbeider, later landbouwer"), ["arbeider", "landbouwer"]);
});

test("jobsFacts: a person counts once per job and per group; windows need 15 people", () => {
  const fixture = {
    groups: { handel: { nl: "Handel", en: "Trade" }, arbeid: { nl: "Arbeiders", en: "Labourers" } },
    jobs: { koopman: { nl: "koopman", en: "merchant", g: "handel" }, werkman: { nl: "werkman", en: "labourer", g: "arbeid" } },
    terms: { koopman: "koopman", koopvrouw: "koopman", venter: "koopman", werkman: "werkman" },
  };
  const ppl = [{ id: "a", occupation: "koopman, koopvrouw, venter", birth: { date: "1800" } }];
  for (let i = 0; i < 14; i++) ppl.push({ id: `p${i}`, occupation: "werkman", birth: { date: "1810" } });
  const f = jobsFacts(ppl, fixture);
  assert.equal(f.n, 15);
  assert.deepEqual(f.top.find((t) => t.j === "koopman"), { j: "koopman", n: 1, ids: ["a"] });
  assert.ok(f.frames.length > 0 && f.frames.every((x) => x.n >= 15));
  assert.equal(f.frames[0].g.handel, 1);
});

test("no unmapped occupations in the generated facts", () => {
  const f = new URL("../src/generated/facts.demo.json", import.meta.url);
  if (!fs.existsSync(f)) return; // run `npm run build` first
  assert.deepEqual(JSON.parse(fs.readFileSync(f, "utf8")).jobs.unmapped, []);
});
