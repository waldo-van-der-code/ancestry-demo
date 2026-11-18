// answerQuestion, validateAsk and the rate limiter, with a fake Groq (no network).
import test from "node:test";
import assert from "node:assert/strict";
import { answerQuestion, validateAsk, createRateLimiter } from "../api/_ask.js";
import { index, fakeGroq, say, callTool } from "./chat-helpers.mjs";

const base = { lang: "en", index, apiKey: "test-key", log: null };

test("a question runs tools, then answers with link chips under the base", async () => {
  const f = fakeGroq([callTool("find_person", { name: "Henri van Aliquam" }), say("Henri Van Aliquam was a brewer in Sluis.")]);
  const r = await answerQuestion({ ...base, q: "Who was Henri van Aliquam?", base: "/demos/family-tree", fetchImpl: f });
  assert.match(r.answer, /brewer/);
  assert.deepEqual(r.links[0], { id: "henri-van-aliquam", name: "Henri Van Aliquam", url: "/demos/family-tree/en/person/henri-van-aliquam/" });
});

test("Dutch answers link to /nl/persoon/ and the default base is empty", async () => {
  const f = fakeGroq([say("Henri Van Aliquam was brouwer.")]);
  const r = await answerQuestion({ ...base, lang: "nl", q: "Wie was Henri van Aliquam?", fetchImpl: f });
  assert.equal(r.links[0].url, "/nl/persoon/henri-van-aliquam/");
});

test("links come from tool results only, never from the model's text", async () => {
  const f = fakeGroq([say("Pieter Van Aliquam and somebody-invented-99 are cousins. See https://evil.example/")]);
  const r = await answerQuestion({ ...base, q: "tell me something", fetchImpl: f });
  assert.deepEqual(r.links, []);
});

test("names in the question are looked up before the model runs", async () => {
  const f = fakeGroq([say("ok")]);
  await answerQuestion({ ...base, q: "How is Jade van Aliquam related to Henri van Aliquam?", fetchImpl: f });
  assert.match(f.calls[0].messages.at(-1).content, /Lookup in the data/);
  assert.match(f.calls[0].messages.at(-1).content, /relation/);
});

test("the last round forbids tool calls (tool_choice none) and rounds are capped at 4", async () => {
  const f = fakeGroq((body, i) => (i < 10 ? callTool("count_people", { place: "Sluis" }, `c${i}`) : say("done")));
  await answerQuestion({ ...base, q: "how many", fetchImpl: f });
  assert.equal(f.calls.length, 4);
  assert.equal(f.calls[3].tool_choice, "none");
  assert.equal(f.calls[0].tool_choice, "auto");
});

test("429 on the main model falls back; 429 on both is busy", async () => {
  const f = fakeGroq((body) => (body.model.endsWith("120b") ? { status: 429 } : say("from the small model")));
  const r = await answerQuestion({ ...base, q: "hello", fetchImpl: f });
  assert.equal(r.answer, "from the small model");
  assert.deepEqual(await answerQuestion({ ...base, q: "hello", fetchImpl: fakeGroq([{ status: 429 }]) }), { busy: true });
});

test("fallbackModel: null makes no second model run", async () => {
  const f = fakeGroq([{ status: 429 }]);
  const r = await answerQuestion({ ...base, q: "hello", fetchImpl: f, fallbackModel: null });
  assert.deepEqual(r, { busy: true });
  assert.equal(f.calls.length, 1);
});

test("onCall counts every request to Groq, not questions", async () => {
  let n = 0;
  const f = fakeGroq([callTool("count_people", { place: "Sluis" }), say("Nineteen.")]);
  await answerQuestion({ ...base, q: "how many in Sluis", fetchImpl: f, onCall: () => n++ });
  assert.equal(n, 2);
  const limiter = createRateLimiter();
  await answerQuestion({ ...base, q: "again", fetchImpl: fakeGroq([say("x")]), onCall: () => limiter.countCall(1000) });
  assert.equal(limiter.callsToday(1000), 1);
});

test("the question, answer and key are never logged", async () => {
  const lines = [];
  const f = fakeGroq([say("Secret-answer Henri.")]);
  await answerQuestion({ ...base, q: "Secret-question about Henri", fetchImpl: f, log: (l) => lines.push(l) });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /tokens_in=10 tokens_out=5/);
  assert.doesNotMatch(lines.join(), /Secret|test-key/);
});

test("validateAsk accepts the contract and rejects everything else", () => {
  assert.deepEqual(validateAsk({ q: "  hi  ", lang: "nl" }), { q: "hi", lang: "nl", history: [] });
  const ok = { q: "x", lang: "en", history: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] };
  assert.equal(validateAsk(ok).history.length, 2);
  for (const bad of [null, [], "x", { q: "", lang: "en" }, { q: " ", lang: "en" }, { q: "x".repeat(501), lang: "en" }, { q: "x", lang: "fr" }, { q: "x", lang: "en", extra: 1 },
    { q: "x", lang: "en", history: Array(5).fill({ role: "user", content: "a" }) }, { q: "x", lang: "en", history: [{ role: "system", content: "a" }] },
    { q: "x", lang: "en", history: [{ role: "user", content: "a".repeat(801) }] }, { q: "x", lang: "en", history: [{ role: "user", content: "a", extra: 1 }] }, { q: 5, lang: "en" }]) {
    assert.equal(validateAsk(bad), null, JSON.stringify(bad).slice(0, 60));
  }
  assert.ok(validateAsk({ q: "x".repeat(500), lang: "en" }));
});

test("rate limiter: per key per hour, global hour and global day", () => {
  const l = createRateLimiter({ perKeyHour: 2, globalHour: 3, globalDay: 4 });
  assert.ok(l.hit("a", 0).ok && l.hit("a", 1).ok);
  assert.equal(l.hit("a", 2).ok, false);
  assert.ok(l.hit("b", 3).ok);
  assert.equal(l.hit("c", 4).ok, false); // 3 per hour overall
  assert.ok(l.hit("a", 3600e3 + 10).ok); // window moved on
  assert.equal(l.hit("d", 3600e3 + 20).ok, false); // 4 per day overall used
});

test("the default limits cap Groq calls per day below the free tier's 1,000 per model", async () => {
  const { DEFAULT_LIMITS } = await import("../api/_ask.js");
  assert.ok(Number.isFinite(DEFAULT_LIMITS.callsPerDay) && DEFAULT_LIMITS.callsPerDay > 0 && DEFAULT_LIMITS.callsPerDay < 1000, String(DEFAULT_LIMITS.callsPerDay));
});
