// Finding names in a question: capitals, lowercase, typos, place spellings.
import test from "node:test";
import assert from "node:assert/strict";
import { candidateNames, lowercaseNames, runTool } from "../api/_ask.js";
import { index } from "./chat-helpers.mjs";

const find = (name) => JSON.parse(runTool("find_person", { name }, { idx: index, lang: "en", seen: new Map(), found: [] }));

test("capitalised runs are picked out, question words are not", () => {
  assert.deepEqual(candidateNames("How is Jade van Aliquam related to Henri van Aliquam?"), ["Jade van Aliquam", "Henri van Aliquam"]);
  assert.deepEqual(candidateNames("what is the weather"), []);
});

test("lowercase names are found and kept in question order", () => {
  assert.deepEqual(lowercaseNames(index, "how is henri van aliquam related to pieter van aliquam"), ["henri van aliquam", "pieter van aliquam"]);
  assert.deepEqual(lowercaseNames(index, "was the family related at all"), []);
});

test("a typo in a two-word name still matches, and says it is approximate", () => {
  const r = find("Henry van Alikwam");
  assert.equal(r.matches[0]?.id, "henri-van-aliquam");
  assert.ok(r.note);
});

test("an exact match is never replaced by a typo match", () => {
  const r = find("Henri");
  assert.ok(r.matches.every((m) => /henri/i.test(m.name)));
  assert.equal(r.note, undefined);
});

test("short words get no typo budget", () => {
  assert.deepEqual(find("Tell Bell").matches, []);
});

test("English town names count the same as the Dutch ones", () => {
  const a = JSON.parse(runTool("count_people", { place: "Ghent", place_role: "born" }, { idx: index, lang: "en", seen: new Map(), found: [] }));
  const b = JSON.parse(runTool("count_people", { place: "Gent", place_role: "born" }, { idx: index, lang: "en", seen: new Map(), found: [] }));
  assert.equal(a.count, b.count);
  assert.ok(a.count > 0);
});
