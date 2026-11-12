// relationship words between two people (pure functions, no site data).
// Convention: stepsB = generations from the common ancestor down to B, stepsA = down to A.
// The sentence is "A is the <word> of B", so (1,0) = A is B's parent and (0,1) = A is B's child.

const ORD_NL = ["", "eerste", "tweede", "derde", "vierde", "vijfde", "zesde", "zevende", "achtste", "negende", "tiende"];
const ORD_EN = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
const ordNl = (n) => ORD_NL[n] || `${n}e`;
const ordEn = (n) => ORD_EN[n] || `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th")}`;
const pick = (sex, m, f, u) => (sex === "m" ? m : sex === "f" ? f : u ?? `${m}/${f}`);
const sfx = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th")}`;
const times = (nl, r) => (nl ? (r === 1 ? "één stap verschoven" : `${r} stappen verschoven`) : r === 1 ? "once removed" : r === 2 ? "twice removed" : `${r} times removed`);

// Ancestor line: A is n steps above B (n >= 1).
function ancestor(n, sex, nl) {
  if (nl) {
    if (n === 1) return pick(sex, "vader", "moeder", "ouder");
    if (n === 2) return pick(sex, "grootvader", "grootmoeder", "grootouder");
    if (n === 3) return pick(sex, "overgrootvader", "overgrootmoeder", "overgrootouder");
    if (n === 4) return pick(sex, "betovergrootvader", "betovergrootmoeder", "betovergrootouder");
    return `voorouder (${n} stappen terug)`;
  }
  if (n === 1) return pick(sex, "father", "mother", "parent");
  const base = pick(sex, "grandfather", "grandmother", "grandparent");
  if (n === 2) return base;
  if (n <= 4) return `${"great-".repeat(n - 2)}${base}`;
  return `${sfx(n - 2)} great-${base}`;
}
// Descendant line: A is n steps below B.
function descendant(n, sex, nl) {
  if (nl) {
    if (n === 1) return pick(sex, "zoon", "dochter", "kind");
    if (n === 2) return pick(sex, "kleinzoon", "kleindochter", "kleinkind");
    if (n === 3) return pick(sex, "achterkleinzoon", "achterkleindochter", "achterkleinkind");
    return `nakomeling (${n} stappen verder)`;
  }
  if (n === 1) return pick(sex, "son", "daughter", "child");
  const base = pick(sex, "grandson", "granddaughter", "grandchild");
  if (n === 2) return base;
  if (n <= 4) return `${"great-".repeat(n - 2)}${base}`;
  return `${sfx(n - 2)} great-${base}`;
}
// Sibling of an ancestor (A is a sibling of B's ancestor k steps above B, k >= 1).
function uncle(k, sex, nl) {
  if (nl) {
    if (k === 1) return pick(sex, "oom", "tante", "oom of tante");
    if (k === 2) return pick(sex, "oudoom", "oudtante", "oudoom of oudtante");
    return `${pick(sex, "oom", "tante", "oom of tante")} (${k} stappen terug)`;
  }
  const base = pick(sex, "uncle", "aunt", "uncle/aunt");
  if (k === 1) return base;
  if (k <= 3) return `${"great-".repeat(k - 1)}${base}`;
  return `${sfx(k - 1)} great-${base}`;
}
// Child (or later descendant) of a sibling of A's ancestor: A is k steps below B's sibling.
function nephew(k, sex, nl) {
  if (nl) {
    if (k === 1) return pick(sex, "neef (zoon van een broer of zus)", "nicht (dochter van een broer of zus)", "kind van een broer of zus");
    if (k === 2) return pick(sex, "kleinzoon van een broer of zus", "kleindochter van een broer of zus", "kleinkind van een broer of zus");
    return `nakomeling van een broer of zus (${k} stappen verder)`;
  }
  const base = pick(sex, "nephew", "niece", "nephew/niece");
  if (k === 1) return base;
  if (k <= 3) return `${"great-".repeat(k - 1)}${base}`;
  return `${sfx(k - 1)} great-${base}`;
}

/** Word for a blood relationship. half only matters for siblings. Returns the noun phrase ("A is <this> of B"). */
export function kinship(stepsB, stepsA, sex, lang, half = false) {
  const nl = lang !== "en";
  const dB = stepsB, dA = stepsA;
  if (dB === 0 && dA === 0) return nl ? "dezelfde persoon" : "the same person";
  if (dA === 0) return ancestor(dB, sex, nl);
  if (dB === 0) return descendant(dA, sex, nl);
  if (dA === 1 && dB === 1) {
    if (nl) return half ? pick(sex, "halfbroer", "halfzus", "halfbroer of halfzus") : pick(sex, "broer", "zus", "broer of zus");
    return half ? pick(sex, "half-brother", "half-sister", "half-sibling") : pick(sex, "brother", "sister", "sibling");
  }
  if (dA === 1) return uncle(dB - 1, sex, nl);
  if (dB === 1) return nephew(dA - 1, sex, nl);
  const m = Math.min(dA, dB), r = Math.abs(dA - dB), degree = m - 1;
  if (nl) {
    // Not "in de eerste graad": in Belgian and Dutch law the degree counts all steps (first cousins = 4th degree).
    const w = degree === 1 ? pick(sex, "volle neef", "volle nicht", "volle neef/nicht")
      : degree === 2 ? pick(sex, "achterneef", "achternicht", "achterneef/achternicht")
      : pick(sex, "verre neef", "verre nicht", "verre neef/nicht");
    return `${w}${r ? ` (${times(true, r)})` : ""}`;
  }
  return `${ordEn(degree)} ${pick(sex, "cousin", "cousin", "cousin")}${r ? ` ${times(false, r)}` : ""}`;
}

const byMarriage = (nl, w) => (nl ? `aangetrouwde ${w}` : `${w} by marriage`);
/**
 * Word for a relationship through marriage. via = "spouseOfA": A's spouse is blood-related to B (spouse is the
 * (stepsB, stepsA) kin of B). via = "spouseOfB": B's spouse is the (stepsB, stepsA) kin of A, seen from A's side
 * as the pair (stepsA, stepsB) i.e. A is the kin of B's spouse. Returns the noun phrase for "A is <this> of B".
 */
export function inLaw(via, stepsB, stepsA, sex, lang) {
  const nl = lang !== "en";
  if (via === "spouse") return pick(sex, nl ? "echtgenoot" : "husband", nl ? "echtgenote" : "wife", nl ? "partner" : "spouse");
  if (via === "spouseOfA") {
    // A's spouse S is the (stepsB, stepsA) kin of B.
    if (stepsB === 1 && stepsA === 0) return nl ? pick(sex, "stiefvader", "stiefmoeder", "stiefouder") : pick(sex, "stepfather", "stepmother", "stepparent");
    if (stepsB === 0 && stepsA === 1) return nl ? pick(sex, "schoonzoon", "schoondochter", "schoonkind") : pick(sex, "son-in-law", "daughter-in-law", "child-in-law");
    if (stepsB === 1 && stepsA === 1) return nl ? pick(sex, "zwager", "schoonzus", "zwager of schoonzus") : pick(sex, "brother-in-law", "sister-in-law", "sibling-in-law");
    return byMarriage(nl, kinship(stepsB, stepsA, sex, lang));
  }
  // spouseOfB: B's spouse T is such that A is the (stepsB, stepsA) kin of T.
  if (stepsB === 0 && stepsA === 1) return nl ? pick(sex, "stiefzoon", "stiefdochter", "stiefkind") : pick(sex, "stepson", "stepdaughter", "stepchild");
  if (stepsB === 1 && stepsA === 0) return nl ? pick(sex, "schoonvader", "schoonmoeder", "schoonouder") : pick(sex, "father-in-law", "mother-in-law", "parent-in-law");
  if (stepsB === 1 && stepsA === 1) return nl ? pick(sex, "zwager", "schoonzus", "zwager of schoonzus") : pick(sex, "brother-in-law", "sister-in-law", "sibling-in-law");
  return byMarriage(nl, kinship(stepsB, stepsA, sex, lang));
}

// ---- graph search over the rows of #facts-data -------------------------------------------------

const parentsOf = (p) => [p.f, p.m].filter(Boolean);

export function upMap(byId, id, cap = 40) {
  const map = new Map([[id, { d: 0, prev: null }]]);
  let layer = [id];
  for (let d = 1; d <= cap && layer.length; d++) {
    const next = [];
    for (const cur of layer) {
      const p = byId.get(cur);
      if (!p) continue;
      for (const par of parentsOf(p)) {
        if (byId.has(par) && !map.has(par)) { map.set(par, { d, prev: cur }); next.push(par); }
      }
    }
    layer = next;
  }
  return map;
}
const chainTo = (map, id) => { const out = []; for (let c = id; c; c = map.get(c).prev) out.push(c); return out; }; // id ... start

/** Nearest common ancestor(s) by parent links. Returns { stepsA, stepsB, ancestors, up (A..anc), down (anc..B), half } or null. */
export function blood(byId, a, b) {
  if (!byId.has(a) || !byId.has(b)) return null;
  const ua = upMap(byId, a), ub = upMap(byId, b);
  let best = null;
  for (const [id, x] of ua) {
    const y = ub.get(id);
    if (!y) continue;
    const sum = x.d + y.d;
    // Ties (pedigree collapse): the most balanced split, so "first cousin once removed" beats "great-uncle".
    const bal = Math.max(x.d, y.d);
    if (!best || sum < best.sum || (sum === best.sum && (bal < best.bal || (bal === best.bal && id < best.id)))) best = { id, sum, bal, x: x.d, y: y.d };
  }
  if (!best) return null;
  const same = [...ua].filter(([id, x]) => ub.has(id) && x.d === best.x && ub.get(id).d === best.y).map(([id]) => id).sort();
  const ancestors = [best.id, ...same.filter((id) => id !== best.id)].slice(0, 2);
  // A pair of common ancestors counts as a couple only when they are the two parents of the same child on both lines.
  // Half-siblings only when both have both parents on record and share exactly one; a missing parent proves nothing.
  const both = (id) => parentsOf(byId.get(id)).filter((x) => byId.has(x));
  const pa = both(a), pb = both(b);
  const half = best.x === 1 && best.y === 1 && pa.length === 2 && pb.length === 2 && pa.filter((x) => pb.includes(x)).length === 1;
  return {
    stepsA: best.x, stepsB: best.y, ancestors, half,
    up: chainTo(ua, best.id).reverse(), // A ... ancestor
    down: chainTo(ub, best.id), // ancestor ... B
  };
}

export function spouses(byId) {
  const adj = new Map();
  const add = (x, y) => { if (!adj.has(x)) adj.set(x, new Set()); adj.get(x).add(y); };
  for (const p of byId.values()) for (const s of p.sp || []) if (byId.has(s.id)) { add(p.id, s.id); add(s.id, p.id); }
  return adj;
}

/** Shortest path through parent/child/spouse edges. Returns [{id, edge}] where edge says how this node relates to the previous one ("child"|"parent"|"spouse"). */
export function shortestPath(byId, spouseAdj, a, b, cap = Infinity) { // no cap: ~2,000 people take well under a millisecond
  if (!byId.has(a) || !byId.has(b)) return null;
  const kids = new Map();
  for (const p of byId.values()) for (const par of parentsOf(p)) { if (!kids.has(par)) kids.set(par, []); kids.get(par).push(p.id); }
  const prev = new Map([[a, null]]);
  let layer = [a];
  for (let d = 0; d < cap && layer.length && !prev.has(b); d++) {
    const next = [];
    for (const cur of layer) {
      const p = byId.get(cur);
      const nb = [
        ...parentsOf(p).filter((x) => byId.has(x)).map((id) => [id, "parent"]),
        ...(kids.get(cur) || []).map((id) => [id, "child"]),
        ...[...(spouseAdj.get(cur) || [])].map((id) => [id, "spouse"]),
      ];
      for (const [id, edge] of nb) if (!prev.has(id)) { prev.set(id, { from: cur, edge }); next.push(id); }
    }
    layer = next;
  }
  if (!prev.has(b)) return null;
  const out = [];
  for (let c = b; c; ) { const r = prev.get(c); out.push({ id: c, edge: r?.edge || null }); c = r?.from; }
  return out.reverse();
}

/**
 * Full answer for A and B. kind: "same" | "blood" | "spouse" | "marriage" | "path" | "none".
 * word is the noun phrase for "A is <word> of B" in the given language; nodes is what to draw.
 */
export function relate(byId, a, b, lang) {
  const A = byId.get(a), B = byId.get(b);
  if (!A || !B) return { kind: "none" };
  if (a === b) return { kind: "same", word: kinship(0, 0, A.s, lang), nodes: [{ id: a }] };
  const bl = blood(byId, a, b);
  if (bl) return { kind: "blood", word: kinship(bl.stepsB, bl.stepsA, A.s, lang, bl.half), steps: bl.stepsA + bl.stepsB, ...bl };
  const adj = spouses(byId);
  const path = shortestPath(byId, adj, a, b);
  if (adj.get(a)?.has(b)) return { kind: "spouse", word: inLaw("spouse", 0, 0, A.s, lang), steps: 1, path };
  // A's spouse is blood kin of B, or B's spouse is blood kin of A: pick the closest.
  let best = null;
  for (const s of adj.get(a) || []) {
    const r = blood(byId, s, b);
    if (r && (!best || r.stepsA + r.stepsB < best.n)) best = { n: r.stepsA + r.stepsB, via: "spouseOfA", sB: r.stepsB, sA: r.stepsA };
  }
  for (const t of adj.get(b) || []) {
    const r = blood(byId, a, t); // A is the (r.stepsB, r.stepsA) kin of T
    if (r && (!best || r.stepsA + r.stepsB < best.n)) best = { n: r.stepsA + r.stepsB, via: "spouseOfB", sB: r.stepsB, sA: r.stepsA };
  }
  if (best) return { kind: "marriage", word: inLaw(best.via, best.sB, best.sA, A.s, lang), steps: path ? path.length - 1 : 0, path };
  if (path) return { kind: "path", steps: path.length - 1, path };
  return { kind: "none" };
}
