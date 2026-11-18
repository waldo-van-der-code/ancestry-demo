// The five tools over the demo index (no model involved).
import test from "node:test";
import assert from "node:assert/strict";
import { runTool, MAX_TOOL_OUT } from "../api/_ask.js";
import { index, raw } from "./chat-helpers.mjs";

const ctx = (lang = "en") => ({ idx: index, lang, seen: new Map(), found: [] });
const run = (name, args, lang) => JSON.parse(runTool(name, args, ctx(lang)));

test("find_person finds by full name, by surname part and returns ids", () => {
  const r = run("find_person", { name: "Henri van Aliquam" });
  assert.equal(r.matches[0].id, "henri-van-aliquam");
  assert.ok(run("find_person", { name: "Aliquam" }).matches.length > 1);
  assert.deepEqual(run("find_person", { name: "Nobody Atall" }).matches, []);
});

test("get_person returns facts, family and the story; unknown ids are an error", () => {
  const r = run("get_person", { id: "henri-van-aliquam" });
  assert.equal(r.occupation, "brouwer");
  assert.match(r.father, /lodewijk-van-aliquam/);
  assert.ok(r.spouses[0].includes("maria-ipsenbeke"));
  assert.ok(r.story);
  assert.ok(run("get_person", { id: "nope" }).error);
});

test("relation words match the kinship module", () => {
  const r = run("relation", { a: "jade-van-aliquam", b: "henri-van-aliquam" });
  assert.ok(r.statement && r.kind !== "none", JSON.stringify(r));
  assert.match(run("relation", { a: "henri-van-aliquam", b: "lodewijk-van-aliquam" }).statement, /son of/);
  assert.match(run("relation", { a: "henri-van-aliquam", b: "lodewijk-van-aliquam" }, "nl").statement, /zoon van/);
});

test("search_text finds a story passage and links it to its person", () => {
  const r = run("search_text", { query: "limonade prijs" });
  assert.equal(r.results[0].person_id, "henri-van-aliquam");
});

test("count_people filters by place role, sex and years", () => {
  const born = run("count_people", { place: "Eeklo", place_role: "born" });
  assert.equal(born.count, raw.p.filter((p) => p.bp === "Eeklo").length);
  assert.equal(run("count_people", { place: "Ghent", place_role: "born" }).count, raw.p.filter((p) => p.bp === "Gent").length);
  assert.ok(run("count_people", {}).error);
  assert.ok(run("count_people", { sex: "f", born_to: 1850 }).count > 0);
});

test("every tool result stays under the size cap", () => {
  for (const [name, args] of [["find_person", { name: "van" }], ["get_person", { id: "pieter-van-aliquam" }], ["search_text", { query: "Sluis" }], ["count_people", { place: "Sluis" }], ["relation", { a: "jade-van-aliquam", b: "johanna-verdolor" }]]) {
    assert.ok(runTool(name, args, ctx()).length <= MAX_TOOL_OUT, name);
  }
});

test("bad arguments never throw", () => {
  for (const args of [null, [], "x", { name: 5 }, {}]) assert.doesNotThrow(() => runTool("find_person", args, ctx()));
  assert.ok(run("no_such_tool", {}).error);
});
