// Search index for the "Ask the family tree" chat. Called at the end of scripts/build-data.mjs.
//
// It reads only the generated, living-person-safe data (src/generated/demo.json and facts.demo.json) and writes
//   api/_chat/demo.json        the index the function loads (committed: it is small and fictional)
//   api/_lib/kinship.mjs       a copy of src/lib/kinship.mjs, because the function may import nothing outside api/
//
// Index shape: { site, p: [person], c: [chunk], x: { token: [chunk index] } }
//   person = facts row (id n g sn s b by bp d dy dp f m sp l) + occ, res, conf, src, st { nl | en }
//   chunk  = { u, t, s }  (url without the site base, title, text)  or  { r: [person index, lang] }
//            where the text is the person's own short story, stored once in the person row.
//
// Living people (l: 1) are sent to a US processor when someone asks about them, so they get a name, family links
// and a birth year at most: no residences, no story, no newspaper text, no full dates.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SITE = "demo";
const MAX_CHUNK = 500;
const MAX_STORY = 400;

// Words that carry no meaning for keyword search (Dutch and English).
const STOP = new Set(
  ("de het een en van in op te dat die dit is zijn was waren wordt werd werden voor met bij aan om ook als maar dan nog niet geen er zich hun haar hij zij ze wij we ik je jij u wat wie waar wanneer hoe welke over naar uit door tot of dus toen deze zo wel al meer veel heeft hebben had hadden kan kon zou the a an and of to in on at is are was were be been it its that this these those for with by from as or but not no he she they you i his her their our what who where when how which about into than then so if do does did has have will would can could there here also more most any some each".split(" ")),
);

export const normalize = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function tokenize(s) {
  const out = [];
  for (const t of normalize(s).split(/[^a-z0-9]+/)) if (t.length >= 2 && !STOP.has(t)) out.push(t);
  return out;
}

// Split on paragraph, then sentence, then word boundaries; never cut a word, never drop text.
export function splitText(text, max = MAX_CHUNK) {
  const out = [];
  let cur = "";
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
  const push = (piece) => {
    if (cur && cur.length + 1 + piece.length > max) flush();
    cur = cur ? `${cur} ${piece}` : piece;
  };
  for (const para of String(text || "").split(/\n{2,}/)) {
    for (const sentence of para.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/)) {
      if (!sentence) continue;
      if (sentence.length <= max) { push(sentence); continue; }
      let words = "";
      for (const w of sentence.split(" ")) {
        if (words && words.length + 1 + w.length > max) { push(words); flush(); words = ""; }
        words = words ? `${words} ${w}` : w;
      }
      if (words) push(words);
    }
    flush();
  }
  return out;
}

// Shorten to at most `max` characters at a word boundary.
function shorten(s, max = MAX_STORY) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 200 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

// URL segments of the template's pages, without the site base (the function adds DEMO_BASE itself).
const SEG = { person: { nl: "persoon", en: "person" }, story: { nl: "verhaal", en: "story" } };
const personPath = (lang, id) => `/${lang}/${SEG.person[lang]}/${id}/`;
const storyPath = (lang) => `/${lang}/${SEG.story[lang]}/`;
const stripMarkdown = (s) => String(s).replace(/<!--[\s\S]*?-->/g, "").replace(/[*_`]+/g, "");
const yearOf = (d) => { const m = d && String(d).match(/(\d{4})/); return m ? m[1] : null; };
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

// The story as chunks, each titled with the nearest heading.
function storyChunks(markdown, lang, label) {
  const out = [];
  let title = label;
  let buffer = [];
  const flush = () => {
    for (const s of splitText(stripMarkdown(buffer.join("\n")))) out.push({ u: storyPath(lang), t: title, s });
    buffer = [];
  };
  for (const line of String(markdown || "").split("\n")) {
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) { flush(); title = `${label}: ${heading[1].trim()}`; } else buffer.push(line);
  }
  flush();
  return out;
}

export function buildIndex(generatedDir = path.join(ROOT, "src/generated")) {
  const data = readJson(path.join(generatedDir, `${SITE}.json`));
  const facts = readJson(path.join(generatedDir, `facts.${SITE}.json`));
  const full = new Map(data.people.map((p) => [p.id, p]));
  const chunks = [];

  const people = facts.people.map((row, rowIndex) => {
    const g = full.get(row.id) || {};
    const p = personRow(row, g);
    const living = !!row.l;
    if (!living) {
      // Dutch is the source text; English only where there is no Dutch.
      const story = {};
      if (g.story) story.nl = shorten(g.story);
      else if (g.story_en) story.en = shorten(g.story_en);
      if (story.nl || story.en) p.st = story;
      // A story that fits in `st` is not stored twice: its chunk points at the person row. Longer ones are split.
      for (const [lang, text] of [["nl", g.story], ["en", g.story ? null : g.story_en]]) {
        if (!text) continue;
        if (String(text).replace(/\s+/g, " ").trim().length <= MAX_STORY) chunks.push({ r: [rowIndex, lang] });
        else for (const s of splitText(text)) chunks.push({ u: personPath(lang, row.id), t: p.n, s });
      }
      for (const lang of ["nl", "en"]) {
        for (const item of g.press || []) {
          const text = item.text?.[lang] && (lang === "nl" || !item.text.nl) ? item.text[lang] : null;
          if (text) chunks.push({ u: personPath(lang, row.id), t: `${p.n} (${item.date || "press"})`, s: text.slice(0, MAX_CHUNK) });
        }
      }
    }
    return p;
  });

  for (const lang of ["nl", "en"]) {
    if (lang === "nl" || !data.chapters?.nl) chunks.push(...storyChunks(data.chapters?.[lang], lang, lang === "nl" ? "Het verhaal" : "The story"));
  }

  // Inverted index over title + text.
  const x = {};
  chunks.forEach((c, i) => {
    const text = c.r ? `${people[c.r[0]].n} ${people[c.r[0]].st[c.r[1]]}` : `${c.t} ${c.s}`;
    for (const t of new Set(tokenize(text))) (x[t] ||= []).push(i);
  });
  return { site: SITE, p: people, c: chunks, x };
}

// One person row of the index: the facts row plus what the chat may say about them.
export function personRow(row, g = {}) {
  const p = { ...row };
  delete p.fam; // one site, nothing to tell apart
  const living = !!row.l;
  if (living) {
    // Birth year only (never a day or month), and the same for a marriage date.
    if (p.b) p.b = yearOf(p.b);
    p.sp = (p.sp || []).map((s) => (s.md ? { ...s, md: yearOf(s.md) } : s));
  }
  if (living) {
    // Name, family links and a birth year: no places, dates of death, occupation or sources.
    for (const k of ["bp", "d", "dy", "dp"]) delete p[k];
    return p;
  }
  if (g.occupation) p.occ = String(g.occupation);
  if (g.residences?.length) p.res = g.residences.map((r) => [r.place, r.period].filter(Boolean).join(" ")).slice(0, 12);
  if (g.confidence) p.conf = g.confidence;
  const docs = [...new Set((g.sources || []).map((s) => s.doc).filter(Boolean))];
  if (docs.length) p.src = docs;
  return p;
}

export function writeChatIndex({ generatedDir = path.join(ROOT, "src/generated"), apiDir = path.join(ROOT, "api") } = {}) {
  fs.mkdirSync(path.join(apiDir, "_chat"), { recursive: true });
  fs.mkdirSync(path.join(apiDir, "_lib"), { recursive: true });
  const file = path.join(apiDir, "_chat", `${SITE}.json`);
  fs.writeFileSync(file, JSON.stringify(buildIndex(generatedDir)));
  fs.copyFileSync(path.join(ROOT, "src/lib/kinship.mjs"), path.join(apiDir, "_lib/kinship.mjs"));
  const size = fs.statSync(file).size;
  console.log(`chat-index ${SITE}: ${(size / 1024).toFixed(0)} KB`);
  return size;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) writeChatIndex();
