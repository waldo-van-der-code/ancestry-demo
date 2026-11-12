// Fun facts page: src/generated/facts.demo.json, built from the generated people.
// `people` is a compact table every view can use in the browser; each view adds its own computed key.
import fs from "node:fs";
import path from "node:path";

const year = (d) => {
  const m = d && String(d).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
};

// Compact person row: short keys and no empty fields keep the page small enough to inline.
function row(p) {
  const r = full(p);
  for (const k of Object.keys(r)) if (r[k] === null || r[k] === 0 || (Array.isArray(r[k]) && !r[k].length)) delete r[k]; // absent = null/0/[]
  return r;
}
function full(p) {
  const death = p.death?.date || null;
  return {
    id: p.id,
    n: ([p.given, p.surname].filter(Boolean).join(" ") || "N.N.") + (p.guess ? " ?" : ""),
    g: p.given || null,
    sn: p.surname || null,
    s: p.sex,
    b: p.birth?.date || null,
    by: year(p.birth?.date),
    bp: p.birth?.place || null,
    d: death,
    dy: year(death),
    dp: p.death?.place || null,
    f: p.father || null,
    m: p.mother || null,
    sp: (p.spouses || []).map((s) => ({ id: s.id, md: s.marriage?.date || null })),
    l: p.living ? 1 : 0,
    fam: p.fam || null,
  };
}

// --- "Did you know" cards. Only full dates (YYYY-MM-DD) count for ages, marriages and birthdays.
const FULL = /^\d{4}-\d{2}-\d{2}$/;
const fullDate = (d) => (d && FULL.test(d) && !isNaN(Date.parse(d)) ? d : null);
// Completed years between two full dates.
function yearsBetween(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number), [y2, m2, d2] = b.split("-").map(Number);
  return y2 - y1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0);
}

export function didYouKnow(people) {
  const by = new Map(people.map((p) => [p.id, p]));
  const out = { excluded: { age: [], parent: [], marriage: [] } };

  // 1. Oldest known ancestor: earliest birth year (approximate "c" dates allowed).
  const born = people.filter((p) => p.by && p.by > 1000).sort((a, b) => a.by - b.by || a.id.localeCompare(b.id));
  if (born[0]) out.oldest = { id: born[0].id, y: born[0].by, approx: String(born[0].b).startsWith("c") || !fullDate(born[0].b) };

  // 2. Longest life (full birth + death dates, 0-110).
  const lives = [];
  for (const p of people) {
    const b = fullDate(p.b), d = fullDate(p.d);
    if (!b || !d) continue;
    const age = yearsBetween(b, d);
    if (age < 0 || age > 110) out.excluded.age.push({ id: p.id, age });
    else lives.push({ id: p.id, age });
  }
  lives.sort((a, b) => b.age - a.age || a.id.localeCompare(b.id));
  if (lives.length) out.longest = { top: lives.slice(0, 3), n: lives.length };

  // 3. Longest marriage: full marriage date to the first death of the two (both full).
  const marr = [];
  const seen = new Set();
  for (const p of people) for (const s of p.sp || []) {
    const q = by.get(s.id), md = fullDate(s.md);
    if (!q || !md) continue;
    const key = [p.id, q.id].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const ds = [fullDate(p.d), fullDate(q.d)];
    if (!ds[0] || !ds[1]) continue;
    const first = ds[0] < ds[1] ? ds[0] : ds[1];
    if (first < md) { out.excluded.marriage.push({ a: p.id, b: q.id, md, first }); continue; }
    // A spouse under 16 at the wedding (or born after it) is a data error, not a record.
    const young = [p, q].some((x) => fullDate(x.b) && yearsBetween(fullDate(x.b), md) < 16);
    if (young) { out.excluded.marriage.push({ a: p.id, b: q.id, md, reason: "spouse under 16" }); continue; }
    marr.push({ a: p.id, b: q.id, md, end: first, years: yearsBetween(md, first) });
  }
  marr.sort((a, b) => b.years - a.years || a.a.localeCompare(b.a));
  if (marr[0]) out.marriage = { ...marr[0], n: marr.length };

  // 4. Most children (counted by f/m links); a couple when most of them share the other parent.
  const kids = new Map();
  for (const p of people) for (const k of ["f", "m"]) if (p[k] && by.has(p[k])) (kids.get(p[k]) || kids.set(p[k], []).get(p[k])).push(p);
  let max = 0;
  for (const c of kids.values()) max = Math.max(max, c.length);
  const tops = [], doneCouples = new Set();
  for (const [pid, c] of [...kids].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (c.length !== max) continue;
    const other = c.map((k) => (k.f === pid ? k.m : k.f)).filter(Boolean);
    const o = other.length > c.length / 2 && other.every((x) => x === other[0]) ? other[0] : null;
    const key = [pid, o].filter(Boolean).sort().join("|");
    if (doneCouples.has(key)) continue;
    doneCouples.add(key);
    tops.push({ ids: o ? [pid, o] : [pid] });
  }
  if (max) out.children = { count: max, groups: tops.slice(0, 3) };

  // 5. Youngest parent (full dates for both, at least 13).
  let young = null;
  for (const p of people) {
    const cb = fullDate(p.b);
    if (!cb) continue;
    for (const k of ["f", "m"]) {
      const par = by.get(p[k]), pb = par && fullDate(par.b);
      if (!pb) continue;
      const age = yearsBetween(pb, cb);
      if (age < 13) { out.excluded.parent.push({ parent: par.id, child: p.id, age }); continue; }
      if (!young || age < young.age || (age === young.age && par.id < young.parent)) young = { parent: par.id, child: p.id, age };
    }
  }
  if (young) out.youngest = young;

  // 6. Twins (and more): same father/mother, same full birth date.
  const groups = new Map();
  for (const p of people) {
    if (!fullDate(p.b) || !(p.f || p.m)) continue;
    const key = `${p.f || ""}|${p.m || ""}|${p.b}`;
    (groups.get(key) || groups.set(key, []).get(key)).push(p.id);
  }
  const tw = [...groups.entries()].filter(([, g]) => g.length > 1).map(([k, g]) => ({ ids: g.sort(), date: k.split("|")[2] }));
  tw.sort((a, b) => a.date.localeCompare(b.date));
  if (tw.length) out.twins = { count: tw.length, groups: tw };

  // 7. Shared birthday: the day-month most people share.
  const days = new Map();
  for (const p of people) {
    const b = fullDate(p.b);
    if (b) (days.get(b.slice(5)) || days.set(b.slice(5), []).get(b.slice(5))).push(p.id);
  }
  const bd = [...days].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
  if (bd && bd[1].length > 1) out.birthday = { md: bd[0], ids: bd[1].sort(), n: [...days.values()].reduce((s, g) => s + g.length, 0) };
  return out;
}


// --- Names: first given names per century of birth, and how a name passes from bearer to bearer.
export function firstName(g) {
  const w = String(g || "").trim().split(/\s+/)[0] || "";
  if (!w || /^n\.?n\.?$/i.test(w) || /^\p{L}\.?$/u.test(w) || /^(\p{L}\.)+$/u.test(w) || !/\p{L}/u.test(w)) return null;
  return w.replace(/[,;]+$/, "");
}
export const centuryOf = (y) => Math.floor((y - 1) / 100) + 1;

export function namesFacts(people) {
  const by = new Map(people.map((p) => [p.id, p]));
  const key = (p) => { const f = firstName(p.g); return f ? f.toLowerCase() : null; };
  // Display form: the most common spelling of the lower-case key.
  const forms = new Map();
  const total = new Map();
  for (const p of people) {
    const k = key(p), f = firstName(p.g);
    if (!k) continue;
    total.set(k, (total.get(k) || 0) + 1);
    const m = forms.get(k) || forms.set(k, new Map()).get(k);
    m.set(f, (m.get(f) || 0) + 1);
  }
  const display = (k) => [...forms.get(k)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const rank = (m) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const out = { centuries: [], overall: rank(total).slice(0, 30).map(([k, c]) => [display(k), c]), follow: {} };

  const cent = new Map();
  for (const p of people) {
    const k = key(p);
    if (!k || !p.by) continue;
    const c = centuryOf(p.by);
    const e = cent.get(c) || cent.set(c, { n: 0, m: new Map(), f: new Map() }).get(c);
    e.n++;
    if (p.s === "m" || p.s === "f") e[p.s].set(k, (e[p.s].get(k) || 0) + 1);
  }
  const wanted = new Set(out.overall.map(([n]) => n.toLowerCase()));
  for (const c of [...cent.keys()].sort((a, b) => a - b)) {
    const e = cent.get(c);
    if (e.n < 10) continue;
    const top = (m) => rank(m).slice(0, 5).map(([k, n]) => { wanted.add(k); return [display(k), n]; });
    out.centuries.push({ c, n: e.n, m: top(e.m), f: top(e.f) });
  }

  // Follow a name: bearers, and for each bearer the nearest bearers above it. A parent with the name = solid link;
  // a grandparent with the name whose child (the parent between) has not = dashed link, `via` = that parent.
  for (const k of [...wanted].sort()) {
    const bearers = people.filter((p) => key(p) === k);
    if (!bearers.length) continue;
    const has = new Set(bearers.map((p) => p.id));
    const links = [];
    for (const p of bearers) for (const pk of ["f", "m"]) {
      const par = by.get(p[pk]);
      if (!par) continue;
      if (has.has(par.id)) { links.push([par.id, p.id, 0, null]); continue; }
      for (const gk of ["f", "m"]) { const gp = by.get(par[gk]); if (gp && has.has(gp.id)) links.push([gp.id, p.id, 1, par.id]); }
    }
    // Sanity: a bearer must be born after the one it descends from (data errors are dropped).
    const ok = links.filter(([a, b]) => !(by.get(a).by && by.get(b).by && by.get(b).by <= by.get(a).by));
    const ids = bearers.map((p) => p.id).sort((a, b) => (by.get(a).by ?? 9999) - (by.get(b).by ?? 9999) || a.localeCompare(b));
    // Longest chain (people in a row) by DP over the DAG, ordered by birth year.
    const parentsOf = new Map();
    for (const [a, b] of ok) (parentsOf.get(b) || parentsOf.set(b, []).get(b)).push(a);
    const best = new Map();
    const depthOf = (id, seen = new Set()) => {
      if (best.has(id)) return best.get(id);
      if (seen.has(id)) return { len: 1, path: [id] };
      seen.add(id);
      let b = { len: 1, path: [id] };
      for (const a of parentsOf.get(id) || []) { const r = depthOf(a, seen); if (r.len + 1 > b.len) b = { len: r.len + 1, path: [...r.path, id] }; }
      seen.delete(id);
      best.set(id, b);
      return b;
    };
    let longest = { len: 1, path: [ids[0]] };
    for (const id of ids) { const r = depthOf(id); if (r.len > longest.len) longest = r; }
    out.follow[display(k)] = { count: bearers.length, ids, links: ok, chain: longest.len, chainIds: longest.path };
  }
  return out;
}

// --- In numbers: births per decade, age at death per century of birth, births per month.
const FAM_ORDER = ["demo"];
const quant = (a, q) => { const i = (a.length - 1) * q, lo = Math.floor(i); return a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (i - lo); };
const r1 = (x) => Math.round(x * 10) / 10;
export function chartsFacts(people) {
  const fams = FAM_ORDER.filter((f) => people.some((p) => p.fam === f));
  // 1. Births per decade (any birth year, also approximate "c" ones).
  const dec = new Map();
  for (const p of people) {
    if (!p.by) continue;
    const d = Math.floor(p.by / 10) * 10;
    const e = dec.get(d) || dec.set(d, fams.map(() => 0)).get(d);
    const i = fams.indexOf(p.fam);
    e[i < 0 ? 0 : i]++;
  }
  const decades = [];
  if (dec.size) for (let d = Math.min(...dec.keys()); d <= Math.max(...dec.keys()); d += 10) decades.push([d, dec.get(d) || fams.map(() => 0)]);
  // 2. Age at death by century of birth: year-level or better on both dates (no "c" dates), ages 0-110.
  const yr = /^\d{4}/;
  const byC = new Map(), excluded = [];
  for (const p of people) {
    if (!p.by || !p.dy || !yr.test(p.b || "") || !yr.test(p.d || "")) continue;
    const age = p.dy - p.by;
    if (age < 0 || age > 110) { excluded.push([p.id, age]); continue; }
    const c = centuryOf(p.by);
    (byC.get(c) || byC.set(c, []).get(c)).push(age);
  }
  const age = [];
  for (const c of [...byC.keys()].sort((a, b) => a - b)) {
    const rows = byC.get(c);
    if (rows.length < 10) continue;
    const all = [...rows].sort((a, b) => a - b);
    age.push({ c, n: all.length, min: all[0], q1: r1(quant(all, 0.25)), med: r1(quant(all, 0.5)), q3: r1(quant(all, 0.75)), max: all[all.length - 1] });
  }
  // 3. Births per month: only month- or day-precision dates.
  const months = Array(12).fill(0);
  for (const p of people) { const m = /^\d{4}-(\d{2})(-\d{2})?$/.exec(p.b || ""); if (m && +m[1] >= 1 && +m[1] <= 12) months[+m[1] - 1]++; }
  return { fams, decades, age, months, excluded };
}

// --- Ancestor fan: reference geography only; ancestry is computed in the browser.
// Country codes refer to present-day geography, never nationality or historical borders.
export function fanFacts(people) {
  const countries = JSON.parse(fs.readFileSync(new URL("../data/place-country.json", import.meta.url), "utf8"));
  return { country: Object.fromEntries([...new Set(people.map((p) => p.bp).filter(Boolean))].sort().map((place) => [place, countries[place] ?? null])) };
}

// --- Professions: raw occupation strings -> jobs -> groups via data/occupations.json.
// A person with several jobs counts once for each distinct job (and each distinct group).
export function splitTerms(s) {
  return String(s || "").replace(/\([^)]*\)/g, " ").split(/\s*(?:\/|,|;|\ben\b|\blater\b)\s*/i)
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean);
}
export function jobsFacts(raw, dict = JSON.parse(fs.readFileSync(new URL("../data/occupations.json", import.meta.url), "utf8"))) {
  const unmapped = new Set();
  const rows = [];
  for (const p of raw) {
    if (!p.occupation) continue;
    const jobs = [];
    for (const t of splitTerms(p.occupation)) {
      if (!(t in dict.terms)) { unmapped.add(t); continue; }
      const j = dict.terms[t];
      if (j && !jobs.includes(j)) jobs.push(j);
    }
    if (jobs.length) rows.push({ id: p.id, by: year(p.birth?.date), jobs, groups: [...new Set(jobs.map((j) => dict.jobs[j].g))] });
  }
  // Most common jobs over all time, with who had them (oldest first).
  const per = new Map();
  for (const r of rows) for (const j of r.jobs) (per.get(j) || per.set(j, []).get(j)).push(r);
  const top = [...per].map(([j, rs]) => ({ j, n: rs.length, ids: rs.sort((a, b) => (a.by ?? 9999) - (b.by ?? 9999) || a.id.localeCompare(b.id)).map((r) => r.id) }))
    .sort((a, b) => b.n - a.n || a.j.localeCompare(b.j));
  // Animation frames: 50-year windows of birth year, every 10 years; a window needs at least 15 people with a job.
  const WIN = 50, STEP = 10, MIN = 15;
  const born = rows.filter((r) => r.by);
  const frames = [];
  if (born.length) {
    const lo = Math.floor(Math.min(...born.map((r) => r.by)) / STEP) * STEP, hi = Math.max(...born.map((r) => r.by));
    for (let from = lo - WIN + STEP; from <= hi; from += STEP) {
      const inW = born.filter((r) => r.by >= from && r.by < from + WIN);
      if (inW.length < MIN) continue;
      const g = {};
      for (const r of inW) for (const k of r.groups) g[k] = (g[k] || 0) + 1;
      const jc = new Map();
      for (const r of inW) for (const j of r.jobs) jc.set(j, (jc.get(j) || 0) + 1);
      const topJob = [...jc].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      frames.push({ from, to: from + WIN - 1, n: inW.length, g, top: topJob });
    }
  }
  const usedGroups = Object.keys(dict.groups).filter((k) => rows.some((r) => r.groups.includes(k)));
  return {
    n: rows.length, nBorn: born.length,
    top: top.slice(0, 12), nJobs: per.size,
    frames,
    jobs: Object.fromEntries([...per.keys()].map((j) => [j, dict.jobs[j]])),
    groups: Object.fromEntries(usedGroups.map((k) => [k, dict.groups[k]])),
    unmapped: [...unmapped].sort(),
  };
}

export function buildFacts(site, generatedDir) {
  const d = JSON.parse(fs.readFileSync(path.join(generatedDir, `${site}.json`), "utf8"));
  const treeFile = path.join(generatedDir, `tree.${site}.json`);
  const tree = fs.existsSync(treeFile) ? JSON.parse(fs.readFileSync(treeFile, "utf8")) : null;
  const people = d.people.map(row);
  return { site, root: tree?.root || null, people, dyk: didYouKnow(people), names: namesFacts(people), charts: chartsFacts(people), fan: fanFacts(people), jobs: jobsFacts(d.people) };
}

export function writeFacts(sites, generatedDir) {
  for (const site of sites) {
    const f = buildFacts(site, generatedDir);
    fs.writeFileSync(path.join(generatedDir, `facts.${site}.json`), JSON.stringify(f));
    console.log(`facts.${site}`, `${f.people.length} people`, `${f.jobs.n} with a job`);
    if (f.jobs.unmapped.length) console.warn(`facts.${site}: occupations not in data/occupations.json:`, f.jobs.unmapped.join(" | "));
  }
}
