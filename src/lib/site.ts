import fs from "node:fs";
import path from "node:path";
import { demoBase } from "../../scripts/demo-base.mjs";

export type Lang = "nl" | "en";
export const LANGS: Lang[] = ["nl", "en"];
// Public copy of the code and fictional data, linked from the banner.
export const DEMO_REPO = "https://github.com/waldo-van-der-code/ancestry-demo";
export const DEMO_BANNER = "Demo with a fictional family";
// Set DEMO_BASE=/some/folder to host the build in a subfolder.
const BASE_PATH = demoBase(process.env.DEMO_BASE);
export const sitePath = (value: string) => {
  if (!value.startsWith("/") || value.startsWith("//")) return value;
  if (BASE_PATH && (value === BASE_PATH || value.startsWith(BASE_PATH + "/"))) return value;
  return BASE_PATH + value;
};

export interface Person {
  id: string;
  given: string | null;
  surname: string | null;
  sex: string;
  father: string | null;
  mother: string | null;
  spouses: { id: string; order: number | null; marriage: { date: string | null; place: string | null } | null; divorced?: boolean; divorceDate?: string | null }[];
  children: string[];
  living: boolean;
  guess?: boolean;
  estBirth: number | null;
  aka?: string[];
  birth?: { date: string | null; place: string | null } | null;
  death?: { date: string | null; place: string | null; circumstance: string | null } | null;
  occupation?: string | null;
  residences?: { place: string; period: string | null }[];
  generation?: number | null;
  story?: string | null;
  story_en?: string | null;
  sources?: { doc: string; pages: number[]; url?: string; ref?: string }[];
  confidence?: string | null;
  records?: { kind: string; with: string | null; url: string; archive: string; source: string; date: string | null; place: string | null; diffs: { field: string; book: string | null; record: string | null }[] }[];
  media?: { file: string; kind: string | null; caption: { nl: string; en: string }; page: number | null; inferred: boolean }[];
  fam?: string;
}

export interface FamilyData {
  family: string;
  people: Person[];
  chapters: { nl: string | null; en: string | null };
  intro: { nl: string | null; en: string | null };
  stats: { people: number; living: number; earliest: number };
}

export const DEMO = {
  host: "example.org",
  name: { nl: "Van Aliquam – De Loremans", en: "Van Aliquam – De Loremans" },
  tagline: { nl: "Een verzonnen familie tussen Vlaanderen en Zeeland.", en: "A fictional family between Flanders and Zeeland." },
  sections: ["people", "story", "sources"],
  root: "jade-van-aliquam",
  start: ["jan-van-aliquam", "lodewijk-van-aliquam", "georges-van-nemo", "felix-dolorsit"],
} as const;

// Localised URL segments; links stay relative to the family host.
export const SEG = {
  people: { nl: "personen", en: "people" },
  person: { nl: "persoon", en: "person" },
  story: { nl: "verhaal", en: "story" },
  map: { nl: "kaart", en: "map" },
  facts: { nl: "weetjes", en: "fun-facts" },
  sources: { nl: "bronnen", en: "sources" },
} as const;
export type Section = keyof typeof SEG;

export const T = {
  nl: {
    home: "Start",
    people: "Personen",
    story: "Het verhaal",
    map: "Kaart",
    facts: "Weetjes",
    tree: "Stamboom",
    sources: "Bronnen",
    born: "Geboren",
    died: "Overleden",
    married: "Gehuwd met",
    divorced: "Gescheiden van",
    divorcedOn: "gescheiden op",
    photos: "Foto's en documenten",
    photoInferred: "wie erop staat is afgeleid, niet zeker",
    photoSource: "Bron",
    close: "Sluiten",
    parents: "Ouders",
    father: "Vader",
    mother: "Moeder",
    children: "Kinderen",
    siblings: "Broers en zussen",
    ancestors: "Voorouders",
    livingShort: "levend",
    unknown: "onbekend",
    guess: "Gok: we zijn hier niet zeker van. Weet je meer? Laat het ons weten.",
    occupation: "Beroep",
    residences: "Woonplaatsen",
    sourceList: "Bronnen",
    page: "p.",
    pages: "pp.",
    search: "Zoek op naam…",
    shown: "getoond",
    confidence: { documented: "Gedocumenteerd", probable: "Waarschijnlijk", "family-story": "Familieverhaal", uncertain: "Onzeker" },
    stats: (s: FamilyData["stats"]) =>
      `${s.people} personen${isFinite(s.earliest) ? `, vanaf ${s.earliest}` : ""}.`,
    storyOnlyNl: "",
    translationPending: "De Engelse vertaling van dit deel volgt nog; hieronder de Nederlandse tekst.",
    scan: "Scan",
    showScan: "Toon scan",
    otherLang: "English",
    legend: "[?] = onzekere lezing · [onleesbaar] = onleesbaar · doorgestreept = doorgehaald in het origineel",
  },
  en: {
    home: "Home",
    people: "People",
    story: "The story",
    map: "Map",
    facts: "Fun facts",
    tree: "Family tree",
    sources: "Sources",
    born: "Born",
    died: "Died",
    married: "Married",
    divorced: "Divorced from",
    divorcedOn: "divorced on",
    photos: "Photos and documents",
    photoInferred: "who is shown is inferred, not certain",
    photoSource: "Source",
    close: "Close",
    parents: "Parents",
    father: "Father",
    mother: "Mother",
    children: "Children",
    siblings: "Siblings",
    ancestors: "Ancestors",
    livingShort: "living",
    unknown: "unknown",
    guess: "A guess: we are not sure about this. Know more? Let us know.",
    occupation: "Occupation",
    residences: "Places lived",
    sourceList: "Sources",
    page: "p.",
    pages: "pp.",
    search: "Search by name…",
    shown: "shown",
    confidence: { documented: "Documented", probable: "Probable", "family-story": "Family story", uncertain: "Uncertain" },
    stats: (s: FamilyData["stats"]) =>
      `${s.people} people${isFinite(s.earliest) ? `, from ${s.earliest}` : ""}.`,
    storyOnlyNl: "Original Dutch text:",
    translationPending: "The English translation of this part is still being prepared; the Dutch text follows.",
    scan: "Scan",
    showScan: "Show scan",
    otherLang: "Nederlands",
    legend: "[?] = uncertain reading · [onleesbaar] = illegible · struck through = crossed out in the original",
  },
};

export function docName(doc: string, lang: Lang) {
  const labels = JSON.parse(fs.readFileSync(path.resolve("data/demo/sources.json"), "utf8"));
  return labels[doc]?.[lang] || doc;
}

let cache: FamilyData | null = null;
export function data(): FamilyData {
  if (!cache) {
    const f = path.resolve("src/generated", "demo.json");
    cache = JSON.parse(fs.readFileSync(f, "utf8"));
  }
  return cache!;
}
let index: Map<string, Person> | null = null;
export function person(id: string | null | undefined): Person | undefined {
  if (!id) return undefined;
  if (!index) index = new Map(data().people.map((p) => [p.id, p]));
  return index.get(id);
}

export const fam = () => DEMO;

// One line under a name that places someone for any relative: their parents, or else their spouse.
// Deliberately not relative to one person.
export function relation(id: string, lang: Lang): string | null {
  const p = person(id);
  if (!p) return null;
  const nl = lang === "nl";
  const pick = (m: string, f: string, u: string) => (p.sex === "m" ? m : p.sex === "f" ? f : u);
  const parents = [person(p.father), person(p.mother)].filter(Boolean).map((x) => fullName(x!));
  if (parents.length) {
    const who = nl ? pick("zoon", "dochter", "kind") : pick("son", "daughter", "child");
    return `${who} ${nl ? "van" : "of"} ${parents.join(nl ? " en " : " and ")}`;
  }
  const sp = p.spouses.map((s) => person(s.id)).find(Boolean);
  if (sp) return `${nl ? pick("man", "vrouw", "partner") : pick("husband", "wife", "partner")} ${nl ? "van" : "of"} ${fullName(sp)}`;
  return null;
}
// Direct ancestors in this site's tree (not the brothers and sisters shown beside them).
let pedigree: Set<string> | null = null;
export function isAncestor(id: string): boolean {
  if (!pedigree) {
    const f = path.resolve(`src/generated/tree.demo.json`);
    const t = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
    const sibs = new Set(Object.values(t?.siblings || {}).flat() as string[]);
    pedigree = new Set(Object.keys(t?.people || {}).filter((x) => !sibs.has(x) && x !== t?.root));
  }
  return pedigree.has(id);
}
// This site's own tree (home page), optionally centred on one person.
export const treeUrl = (lang: Lang, id?: string) => sitePath(`/${lang}/`) + (id ? `?p=${encodeURIComponent(id)}` : "");
let treeIds: Set<string> | null = null;
export function inTree(id: string): boolean {
  if (!treeIds) {
    const f = path.resolve(`src/generated/tree.demo.json`);
    treeIds = new Set(fs.existsSync(f) ? Object.keys(JSON.parse(fs.readFileSync(f, "utf8"))?.people || {}) : []);
  }
  return treeIds.has(id);
}
export const url = (lang: Lang, sec?: Section, id?: string) =>
  sitePath(`/${lang}/` + (sec ? `${SEG[sec][lang]}/` : "") + (id ? `${id}/` : ""));
export const personUrl = (lang: Lang, id: string) => url(lang, "person", id);

// Plain text; a guessed person ends in " ?" (the <Name> component adds the explanation on hover).
export const fullName = (p: Person) => ([p.given, p.surname].filter(Boolean).join(" ") || "N.N.") + (p.guess ? " ?" : "");

const MONTHS = {
  nl: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
export function fmtDate(d: string | null | undefined, lang: Lang): string {
  if (!d) return "";
  const c = d.startsWith("c") ? (lang === "nl" ? "ca. " : "c. ") : "";
  const m = d.replace(/^c/, "").match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return d;
  const [, y, mo, da] = m;
  if (!mo) return c + y;
  const month = MONTHS[lang][Number(mo) - 1];
  if (!da) return `${c}${month} ${y}`;
  return lang === "nl" ? `${c}${Number(da)} ${month} ${y}` : `${c}${Number(da)} ${month} ${y}`;
}
export const yearOf = (d?: string | null) => (d ? (d.match(/\d{4}/) || [""])[0] : "");
export function lifespan(p: Person, lang: Lang): string {
  if (p.living) return yearOf(p.birth?.date) ? `° ${yearOf(p.birth?.date)}` : T[lang].livingShort;
  const b = yearOf(p.birth?.date) || "?";
  const d = yearOf(p.death?.date) || (p.death?.circumstance ? "?" : "");
  if (b === "?" && !d) return "";
  return d ? `${b}–${d}` : `° ${b}`;
}

export function siblings(p: Person): Person[] {
  const ids = new Set<string>();
  for (const par of [p.father, p.mother]) for (const c of person(par)?.children || []) if (c !== p.id) ids.add(c);
  // Oldest first, also across half-siblings from the other parent.
  return [...ids].map((i) => person(i)!).filter(Boolean).sort((a, b) => (a.estBirth ?? 9999) - (b.estBirth ?? 9999));
}

// Very small markdown renderer for the source texts (headings, paragraphs, emphasis, strike, lists).
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\^\{(.+?)\}/g, '<sup class="ins">$1</sup>')
    .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>")
    .replace(/\[(\?|onleesbaar)\]/g, '<span class="unc">[$1]</span>')
    .replace(/\[([^\]]+)\]\((\/[^)\s"*~^]*)\)/g, (_, text, href) => `<a href="${sitePath(href)}">${text}</a>`) // site-relative links 
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s"*~^]*)\)/g, '<a href="$2" rel="noreferrer">$1</a>'); // external links 
}
// Heading ids, made unique within one document: the headings can repeat within one document.
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
function idMaker() {
  const seen = new Map<string, number>();
  return (text: string) => { const b = slug(text); const n = (seen.get(b) || 0) + 1; seen.set(b, n); return n > 1 ? `${b}-${n}` : b; };
}
export function md(src: string | null | undefined, opts: { lines?: boolean } = {}): string {
  if (!src) return "";
  const nextId = idMaker();
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join(opts.lines ? "<br>" : " ")}</p>`);
    if (list.length) out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`);
    para = [];
    list = [];
  };
  for (const raw of src.replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const lvl = Math.min(h[1].length + 1, 5);
      const id = nextId(h[2]);
      out.push(`<h${lvl} id="${id}">${inline(h[2])}</h${lvl}>`);
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (para.length) { out.push(`<p>${para.map(inline).join(" ")}</p>`); para = []; }
      list.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (/^-{3,}$/.test(line.trim())) {
      flush();
      out.push("<hr>");
    } else if (!line.trim()) {
      flush();
    } else {
      if (list.length) flush();
      para.push(line.trim());
    }
  }
  flush();
  return out.join("\n");
}
export function headings(src: string | null | undefined): { id: string; text: string; level: number }[] {
  if (!src) return [];
  const nextId = idMaker(); // count every heading level, as md() does, so the ids match
  return [...src.replace(/<!--[\s\S]*?-->/g, "").matchAll(/^(#{1,4})\s+(.*)$/gm)]
    .map((m) => ({ level: m[1].length, text: m[2], id: nextId(m[2]) }))
    .filter((h) => h.level <= 2);
}
