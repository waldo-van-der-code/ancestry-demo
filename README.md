# Ancestry demo: a fictional family-history site

A small, complete family-history website built with [Astro](https://astro.build) and a fictional family
("Van Aliquam – De Loremans", 57 invented people, six generations, 1789 to today). It was built with the help
of AI agents and is published as a starting point: copy it, replace the data with your own family and you have
a static site with

- an interactive pedigree (zoom, drag, unfold ancestors, brothers and sisters beside them),
- a page per person with parents, partners, children, an ancestor chart, sources and confidence labels,
- the family story, a people index with search, and a sources page,
- a map with a time slider, play mode and optional historical map layers,
- a "fun facts" page: did-you-know cards, lifelines, names, charts, professions, an ancestor fan and a
  "how are we related?" tool,
- a home page with a name finder and an optional "Ask the family tree" chat (see below),
- a printed-booklet look ("boekje": bottle-green cloth, gold titles, Libre Caslon Text and Libre Franklin, self-hosted),
- Dutch and English (the Dutch is the original; every page has an English twin).

How the real family site behind it was researched and built, with the prompt to start your own:
[The agentic Christmas gift: a family tree](https://waldo.vanderlore.de/blog/find-the-people-you-come-from/).

Everything on the demo is invented. The towns are real, the people, records and stories are not. Source links use
the reserved `example.org` domain.

## Build and preview

```sh
npm install
npm run build        # data build + Astro build into dist/
npm run serve        # http://127.0.0.1:4510/en/  (DEMO_PORT=... to change the port)
npm test             # node tests: data integrity, kinship words, occupations, privacy
npm run test:browser # Playwright journeys against dist/ (needs: npx playwright install chromium)
```

To host the site in a subfolder, build and serve with the same mount:

```sh
DEMO_BASE=/demos/family-tree npm run build
DEMO_BASE=/demos/family-tree npm run serve   # http://127.0.0.1:4510/demos/family-tree/en/
```

Copy the contents of `dist/` to your host. It is plain static files and needs no environment variables and no
server. Only the optional chat needs a small function (see "Ask the family tree" below); without it the chat page says
it is not set up and everything else works. Every page carries `noindex, nofollow`; remove that meta tag in `src/layouts/Base.astro`
(and the two redirect pages in `src/pages/`) if you want your site to be indexed. Check the terms of every
archive and photo you use before making a site of real people public.

## Swap in your own family

All content lives in `data/`; the build reads `data/demo/` and turns it into `src/generated/` (git-ignored).

| File | What |
|---|---|
| `data/demo/people.json` | One object per person (schema below). |
| `data/demo/chapters.md`, `chapters.en.md` | The family story (Markdown: `#` and `##` headings become the table of contents). |
| `data/demo/intro.nl.md`, `intro.en.md` | One paragraph under the title on the home page. |
| `data/demo/sources.json` | Display names of your source keys, per language. |
| `data/demo/records-check.json` | Optional matches against original records (birth, marriage, death); where a record disagrees with the family book the page shows both. |
| `data/demo/newspapers.json` | Optional newspaper finds per person. |
| `data/demo/media.json` | Optional photos: `file`, `caption_nl`, `caption_en`, `people`, optional `credit`, `licence`, `url`. Put the files in `public/media/` and 360 px thumbnails in `public/media/thumb/`. |
| `data/occupations.json` | Maps every occupation term used in `people.json` to a job and a job group (the professions chart). A term that is missing shows up in the build log. |
| `data/places.json` | Coordinates (`lat`, `lon`) per place name, for the map. Add every place name you use under `found` (or `override`). |
| `data/place-country.json` | Country code (`BE`, `NL`, ...) per birth place, for the colours of the ancestor fan. |
| `src/lib/site.ts` | Family name, tagline, which person is the tree root (`root`) and who is listed under "Start here" (`start`). Change `DEMO_REPO` and `DEMO_BANNER` too, or delete the banner in `src/layouts/Base.astro`. |
| `scripts/build-data.mjs` | `TREE_ROOT`: the person whose ancestors the home page tree shows. |

### `people.json`

A JSON array. Dates are `YYYY-MM-DD`, `YYYY-MM` or `YYYY`; write an approximate date as `c1850`. Use `null` for
anything the sources do not say.

```json
{
  "id": "first-person",                 // unique slug, used in URLs and for links between people
  "given": "Given Names",
  "surname": "Surname",
  "sex": "m",                           // m | f | u
  "birth": { "date": "1854-03-12", "place": "Town" },
  "death": { "date": null, "place": null, "circumstance": null },
  "father": "id-or-null",
  "mother": "id-or-null",
  "spouses": [{ "id": "partner-id", "order": 1, "marriage": { "date": "1880-05-01", "place": "Town" } }],
  "occupation": "landbouwer",           // optional; see data/occupations.json
  "residences": [{ "place": "Town", "period": "1854-1900" }],
  "aka": ["other spellings"],           // optional
  "story": "Dutch text, a few plain sentences.",
  "story_en": "English text.",
  "sources": [{ "doc": "source-key", "ref": "entry 18", "pages": [3, 7], "url": "https://..." }],
  "confidence": "documented",           // documented | probable | family-story | uncertain
  "guess": false                        // true shows a "?" behind the name: identity or link is a guess
}
```

- `children` are derived from `father` and `mother`; spouses must link to each other.
- `confidence` grades the facts on the person page; `guess` flags a doubtful identity.
- Source keys (`doc`) are looked up in `data/demo/sources.json`; an unknown key is shown as written.
- **Living people.** Anyone without a death entry whose (estimated) birth year is after 1926 is treated as possibly
  living: the build keeps only the name and the family links and drops dates, places, stories and sources from
  every generated page and chart. Change `LIVING_CUTOFF` in `scripts/build-data.mjs` if you want a different rule.
- Where a matched record in `records-check.json` differs from `people.json`, the site shows the record's value
  and lists the difference.

## Ask the family tree (optional chat)

The home page and `/en/ask/` (`/nl/vraag/`) let visitors ask questions in plain words ("How is Jade Van Aliquam
related to Henri Van Aliquam?", "How many people were born in Sluis?"). Answers come from the site's own data
through a small Vercel function, `api/ask.js`, which looks things up with a few tools (find a person, get a person,
relationship, text search, count) and lets a model on Groq write the sentence.

Set it up:

1. Create a free account at [console.groq.com](https://console.groq.com) and an API key.
2. Deploy the project to Vercel (`vercel.json` already sets the build, `dist` as output and a 30 s function limit).
3. In the Vercel project settings add the environment variable `GROQ_API_KEY`. Nothing else is required.

What it costs: nothing on Groq's free tier, which is limited per model (at the time of writing about 1,000 requests
per day and 8,000 tokens per minute for the default models; check Groq's current limits). One question uses one to
four requests. When Groq says "too many requests" the function retries once on the smaller fallback model and then
answers that it is busy.

Privacy: a question, the last four messages of the conversation and the facts the tools find are sent to Groq in the
US to be answered. People who may still be alive (born after 1926 or with no death date) are in the index with a name,
family links and at most a birth year: no birth or death place, occupation, sources, residences or story text. The function logs token counts only, never the
question, the answer or the key. The conversation is kept in the visitor's own browser (`localStorage`). The page
says so under the question box.

Change things:

| What | How |
|---|---|
| Models | env `CHAT_MODEL` (default `openai/gpt-oss-120b`) and `CHAT_FALLBACK_MODEL` (default `openai/gpt-oss-20b`) |
| Limits | env `ASK_PER_IP_HOUR` (20), `ASK_PER_HOUR` (60), `ASK_PER_DAY` (200) questions and `ASK_CALLS_PER_DAY` (800) Groq requests; counted in memory per server instance. Only the site's own pages can ask (same-origin JSON POST) |
| Links under a folder | env `DEMO_BASE`, the same value you build with (for example `/demos/family-tree`) |
| Another endpoint | build with `PUBLIC_ASK_URL=/api/my-folder/ask/` (default `/api/ask/`, always from the domain root) |
| Your own place names | `EXONYMS` in `api/_ask.js` maps English or old town names to the spelling in your data |

`npm run build` rewrites the search index `api/_chat/demo.json` and `api/_lib/kinship.mjs` (a copy, because the function
may import only from `api/`). Both are committed, and `evals/chat-index.test.mjs` fails if they are stale.

On static-only hosting (GitHub Pages, Netlify drop, any plain file server) there is no function: the chat page answers
"The chat is not set up on this copy" and nothing else changes. The question box never puts the question in the URL.

## Layout

```
src/pages        routes (Dutch and English), src/layouts/Base.astro the page frame
src/components   Tree, MapView, PersonCard, Name, AskPanel and the fun-facts views (src/components/facts/)
src/styles       boekje.css (the booklet look, scoped to html.boekje)
src/lib          site.ts (labels, helpers, markdown), kinship.mjs (relationship words, pure functions)
scripts          build-data.mjs (data -> src/generated), facts.mjs, serve-demo.mjs
api              ask.js (the chat function), _ask.js (tools, Groq loop, limits), _chat/ and _lib/ (generated, committed)
vercel.json      Vercel build settings and the function's time limit (only needed for the chat)
evals            node tests and the Playwright journeys (evals/browser/)
public/fonts     self-hosted Libre Caslon Text and Libre Franklin (woff2, fonts.css, licences)
public/vendor    self-hosted Leaflet, so the site loads nothing from third-party CDNs
```

The preview server sends a strict Content-Security-Policy (`evals/demo-csp.mjs`) and the browser test fails if the
site starts depending on a third-party script, style or font. Only map tile images load from other hosts
(OpenStreetMap and the optional historical layers in `src/components/MapView.astro`).

## Privacy check for your own data

`evals/privacy.test.mjs` shows how to keep real names out of a public repo: it scans every tracked file and the
built `dist/` against a private denylist that lives outside the repository. Generate a JSON file with
`{ "protected": [...], "surnames": [...], "fullNames": [...], "ids": [...] }` from your real data and run
`PRIVACY_DENYLIST=/path/to/denylist.json npm test`. Without the variable the check is skipped.

## Licences

- This project: MIT, see `LICENSE` (copyright Waldo Vanderhaeghen).
- Fonts in `public/fonts/`: Libre Caslon Text and Libre Franklin via `@fontsource`, SIL Open Font Licence 1.1
  (licence texts next to the font files).
- Leaflet 1.9.4 in `public/vendor/leaflet/`: BSD 2-Clause (see `public/vendor/leaflet/LICENSE`).
- `public/vendor/manifest.json` records the package versions and a SHA-256 for every vendored file.
- Map tiles are loaded from OpenStreetMap (© OpenStreetMap contributors); the historical layers have their own
  terms, shown in the map's attribution line.
