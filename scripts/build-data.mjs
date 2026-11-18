// Builds src/generated/demo.json (people, story), tree.demo.json, map.demo.json and facts.demo.json,
// then the chat index in api/_chat/.
// from data/demo/. Living people are reduced to their name.
import fs from "node:fs";
import path from "node:path";
import { writeFacts } from "./facts.mjs";
import { writeChatIndex } from "./chat-index.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "src/generated");
const LIVING_CUTOFF = 1926; // born after this and no death date => possibly living
const GEN_GAP = 28;

const year = (d) => {
  if (!d) return null;
  const m = String(d).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
};

function readPeople(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, "people.json"), "utf8"));
}

function isDead(p) {
  return Boolean(p.death?.date || p.death?.place || p.death?.circumstance);
}

function estimateBirths(people, byId, children) {
  const est = new Map(people.map((p) => [p.id, year(p.birth?.date) ?? p.est_birth?.year ?? null]));
  for (const p of people) {
    if (est.get(p.id) == null && year(p.death?.date)) est.set(p.id, year(p.death.date) - 60);
  }
  for (let round = 0; round < 8; round++) {
    let changed = false;
    for (const p of people) {
      if (est.get(p.id) != null) continue;
      const cands = [];
      for (const par of [p.father, p.mother]) if (par && est.get(par) != null) cands.push(est.get(par) + GEN_GAP);
      for (const c of children.get(p.id) || []) if (est.get(c) != null) cands.push(est.get(c) - GEN_GAP);
      for (const s of p.spouses || []) if (byId.has(s.id) && est.get(s.id) != null) cands.push(est.get(s.id));
      if (cands.length) {
        est.set(p.id, Math.round(cands.reduce((a, b) => a + b, 0) / cands.length));
        changed = true;
      }
    }
    if (!changed) break;
  }
  return est;
}

// The original records are more trustworthy than the family book: where a matched record differs from
// the book or fills a gap, the site uses the record's date and place. people.json (the book) stays as it is; the
// book's value stays visible in the person's records list. Parent name differences don't change who the parents are.
function preferRecords(o) {
  for (const r of o.records || []) {
    // A record that gives the full date where the book has only the month or year (same date, more precise).
    const ev = r.kind === "marriage" ? o.spouses.find((x) => x.id === r.with)?.marriage : o[r.kind];
    const bd = ev?.date?.replace(/^c/, "");
    if (bd && r.date && r.date.length > bd.length && r.date.startsWith(bd) && !(r.diffs || []).some((d) => d.field.endsWith(".date"))) {
      if (r.kind === "marriage") { const s = o.spouses.find((x) => x.id === r.with); s.marriage = { ...s.marriage, date: r.date }; }
      else o[r.kind] = { ...o[r.kind], date: r.date };
    }
    for (const d of r.diffs || []) {
      const [ev, f] = d.field.split(".");
      if (!f || d.record == null) continue;
      if (ev === "marriage") {
        const s = o.spouses.find((x) => x.id === r.with);
        if (s) s.marriage = { date: null, place: null, ...(s.marriage || {}), [f]: d.record };
        continue;
      }
      o[ev] = { ...(o[ev] || { date: null, place: null }), [f]: d.record };
    }
  }
  return o;
}

function buildFamily(family) {
  const dir = path.join(ROOT, "data", family);
  const people = fs.existsSync(dir) ? readPeople(dir) : [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const children = new Map();
  for (const p of people) {
    for (const par of [p.father, p.mother]) {
      if (!par || !byId.has(par)) continue;
      if (!children.has(par)) children.set(par, []);
      children.get(par).push(p.id);
    }
  }
  const est = estimateBirths(people, byId, children);
  // Photos and documents (data/<family>/media.json), attached to every person they show.
  const mediaFile = path.join(dir, "media.json");
  const media = new Map();
  for (const m of fs.existsSync(mediaFile) ? JSON.parse(fs.readFileSync(mediaFile, "utf8")) : []) {
    const item = { file: m.file, kind: m.kind || null, caption: { nl: m.caption_nl || "", en: m.caption_en || m.caption_nl || "" }, page: m.page ?? null, inferred: m.confidence === "inferred", credit: m.credit ? { text: m.credit, licence: m.licence || null, url: m.url || null } : null };
    for (const id of m.people || []) if (byId.has(id)) (media.get(id) || media.set(id, []).get(id)).push(item);
  }
  // Matches against original records (data/<family>/records-check.json). A marriage is stored on one partner; show it on both.
  const records = new Map();
  for (const checkFile of [path.join(dir, "records-check.json")]) {
    if (!fs.existsSync(checkFile)) continue;
    for (const [id, cs] of Object.entries(JSON.parse(fs.readFileSync(checkFile, "utf8")).people || {})) {
      for (const c of cs) {
        if (c.status !== "matched") continue;
        const r = { kind: c.kind, with: c.with || null, url: c.url, archive: c.archive, source: c.source, date: c.date, place: c.place, diffs: c.diffs || [] };
        (records.get(id) || records.set(id, []).get(id)).push(r);
        if (c.with) (records.get(c.with) || records.set(c.with, []).get(c.with)).push({ ...r, with: id });
      }
    }
  }
  // Newspaper finds: data/<family>/newspapers.json.
  const pressFile = path.join(dir, "newspapers.json");
  const press = new Map();
  for (const n of fs.existsSync(pressFile) ? JSON.parse(fs.readFileSync(pressFile, "utf8")) : []) {
    const item = { date: n.date, links: n.links, rating: n.rating, text: { nl: n.nl || n.en, en: n.en || n.nl }, probable: !!n.probable, clip: n.clip };
    for (const id of n.people || []) if (byId.has(id)) (press.get(id) || press.set(id, []).get(id)).push(item);
  }
  const out = people.map((p) => {
    const e = est.get(p.id);
    const living = !isDead(p) && (e == null || e > LIVING_CUTOFF);
    const kids = (children.get(p.id) || []).slice().sort((a, b) => (est.get(a) ?? 9999) - (est.get(b) ?? 9999));
    const base = {
      id: p.id,
      fam: family,
      given: p.given,
      surname: p.surname,
      // A guessed person (identity not yet confirmed by a record) shows "?" after the name, so family can correct it.
      guess: !!p.guess,
      sex: p.sex,
      father: byId.has(p.father) ? p.father : null,
      mother: byId.has(p.mother) ? p.mother : null,
      spouses: (p.spouses || []).filter((s) => byId.has(s.id)).map((s) => {
        const partner = byId.get(s.id);
        const hide = !isDead(partner) && (est.get(s.id) == null || est.get(s.id) > LIVING_CUTOFF);
        return { id: s.id, order: s.order ?? null, marriage: hide ? null : s.marriage ?? null, divorced: !hide && !!s.divorced, divorceDate: !hide && typeof s.divorced === "string" ? s.divorced : null };
      }),
      children: kids,
      living,
      estBirth: e,
    };
    // Living people keep names and tree links, with no living-person details in any generated view.
    if (living) return {
      ...base, estBirth: null,
      spouses: base.spouses.map(s => ({ ...s, marriage: null, divorced: false, divorceDate: null })),
    };
    const residences = p.residences || [];
    return preferRecords({
      ...base,
      aka: p.aka || [],
      birth: p.birth || null,
      death: p.death || null,
      occupation: p.occupation || null,
      residences: p.lives && !residences.some((r) => r.place === p.lives) ? [...residences, { place: p.lives, period: null }] : residences,
      generation: p.generation ?? null,
      story: p.story || null,
      story_en: p.story_en || null,
      sources: p.sources || [],
      confidence: p.confidence || null,
      media: media.get(p.id) || [],
      records: records.get(p.id) || [],
      press: press.get(p.id) || [],
    });
  });
  const read = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8") : null);
  const result = {
    family,
    people: out,
    chapters: { nl: read("chapters.md"), en: read("chapters.en.md") },
    intro: { nl: read("intro.nl.md"), en: read("intro.en.md") },
    stats: {
      people: out.length,
      living: out.filter((p) => p.living).length,
      earliest: Math.min(...out.filter((p) => !p.living && year(p.birth?.date)).map((p) => year(p.birth.date))),
    },
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${family}.json`), JSON.stringify(result));
  return result;
}

// Home-page tree: the ancestors of the root person. Layout happens in the browser (src/components/Tree.astro)
// so lines can be unfolded one at a time.
const TREE_ROOT = "jade-van-aliquam";

function buildTree(all, treeRoot = TREE_ROOT) {
  const byId = new Map(all.map((p) => [p.id, p]));
  const people = {};
  const add = (id, depth = 0) => {
    const p = id && byId.get(id);
    if (!p || people[id] || depth > 30) return;
    const y1 = year(p.birth?.date), y2 = year(p.death?.date);
    people[id] = {
      fam: "demo", given: p.given || "", surname: p.surname || "", guess: !!p.guess,
      years: p.living ? "" : `${y1 ?? "?"}–${y2 ?? (p.death?.circumstance ? "?" : "")}`,
      living: p.living,
      father: p.father && byId.has(p.father) ? p.father : null,
      mother: p.mother && byId.has(p.mother) ? p.mother : null,
    };
    add(p.father, depth + 1);
    add(p.mother, depth + 1);
  };
  add(treeRoot);
  if (!people[treeRoot]) return null;
  // Full brothers and sisters of every ancestor, in birth order. The tree shows them beside that person
  // once their parents are unfolded.
  const pedigree = Object.keys(people);
  const siblings = {};
  for (const pid of pedigree) {
    const pp = people[pid];
    if (pid === treeRoot || !pp.father || !pp.mother) continue;
    const sibs = all
      .filter((q) => q.id !== pid && !pedigree.includes(q.id) && q.father === pp.father && q.mother === pp.mother)
      .sort((a, b) => (a.birth?.date || "9999").localeCompare(b.birth?.date || "9999"))
      .map((q) => q.id);
    if (!sibs.length) continue;
    siblings[pid] = sibs;
    for (const id of sibs) add(id);
  }
  return { root: treeRoot, people, siblings };
}

// Map: one point per (person, event, place), with coordinates from data/places.json.
// Places without coordinates are counted, not shown.
function buildMap(all) {
  const file = path.join(ROOT, "data/places.json");
  const db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { override: {}, found: {} };
  const coord = (s) => { if (!s) return null; s = String(s).trim(); const c = db.override?.[s] ?? db.found?.[s]; return c && c.lat != null ? c : null; };
  const places = {}, points = [], seen = new Set();
  let unplaced = 0;
  const add = (p, type, place, y) => {
    if (!place) return;
    const c = coord(place);
    if (!c) { unplaced++; return; }
    const key = `${c.lat},${c.lon}`;
    places[key] ??= { lat: c.lat, lon: c.lon, name: String(place).replace(/\s*\(.*?\)\s*/g, " ").trim() };
    const k = `${p.id}|${type}|${key}`;
    if (seen.has(k)) return;
    seen.add(k);
    points.push({ f: "demo", fs: ["demo"], id: p.id, n: [p.given, p.surname, p.guess && "?"].filter(Boolean).join(" "), t: type, p: key, y: y ?? null, ...(p.living && { l: 1 }) });
  };
  for (const p of all) {
    add(p, "born", p.birth?.place, year(p.birth?.date) ?? p.estBirth);
    for (const r of p.residences || []) add(p, "lived", r.place, year(r.period));
    add(p, "died", p.death?.place, year(p.death?.date));
  }
  return { places, points, unplaced };
}

const result = buildFamily("demo");
console.log("demo", JSON.stringify(result.stats));
const tree = buildTree(result.people);
fs.writeFileSync(path.join(OUT, "tree.demo.json"), JSON.stringify(tree));
console.log("tree.demo", tree ? `${Object.keys(tree.people).length} people` : "none");
fs.writeFileSync(path.join(OUT, "map.demo.json"), JSON.stringify(buildMap(result.people)));
// Fun facts page: one facts file.
writeFacts(["demo"], OUT);
// Search index for the "Ask the family tree" chat (api/_chat/demo.json, committed).
writeChatIndex({ generatedDir: OUT });
