// The name list behind the home page's "find someone" box: [id, name, years] per person.
// A separate file so the home page stays light on phones; the box loads it on first use.
import { LANGS, data, fullName, lifespan, type Lang } from "../../lib/site";

export function getStaticPaths() {
  return LANGS.map((lang) => ({ params: { lang } }));
}

export function GET({ params }: { params: { lang: Lang } }) {
  const rows = data().people.map((p) => [p.id, fullName(p), lifespan(p, params.lang)]);
  return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });
}
