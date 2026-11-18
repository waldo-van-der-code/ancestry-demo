// POST /api/ask: answers one question about the family tree through Groq.
// Setup: set GROQ_API_KEY in the host's environment variables (see the README, "Ask the family tree").
// Optional env: CHAT_MODEL, CHAT_FALLBACK_MODEL, DEMO_BASE, ASK_PER_IP_HOUR, ASK_PER_HOUR, ASK_PER_DAY, ASK_CALLS_PER_DAY.
import raw from "./_chat/demo.json" with { type: "json" };
import { answerQuestion, createIndex, createRateLimiter, validateAsk } from "./_ask.js";

const index = createIndex(raw);
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const limiter = createRateLimiter({
  perKeyHour: num(process.env.ASK_PER_IP_HOUR, 20),
  globalHour: num(process.env.ASK_PER_HOUR, 60),
  globalDay: num(process.env.ASK_PER_DAY, 200),
  callsPerDay: num(process.env.ASK_CALLS_PER_DAY, 800),
});

// Same rule as scripts/demo-base.mjs (api/ may import nothing outside itself): "" or "/folder", no trailing slash.
function demoBase(value) {
  const v = String(value || "").trim().replace(/^\/+|\/+$/g, "");
  return v && /^[A-Za-z0-9._~\/-]+$/.test(v) && !v.split("/").some((s) => s === "." || s === "..") ? `/${v}` : "";
}

const send = (res, status, body, headers = {}) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
};

async function readBody(req, max = 8192) {
  if (req.body !== undefined && req.body !== null) return typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const parts = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > max) throw Object.assign(new Error("too large"), { status: 413 });
    parts.push(part);
  }
  return Buffer.concat(parts).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" }, { allow: "POST" });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return send(res, 503, { error: "not configured" });
  // Only this site's own pages may ask: another site's page could otherwise spend the quota from its visitors' browsers.
  const origin = req.headers.origin;
  if (origin) {
    let host = "";
    try { host = new URL(origin).host; } catch { /* malformed */ }
    if (!host || host !== req.headers.host) return send(res, 403, { error: "forbidden" });
  }
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) return send(res, 415, { error: "json only" });
  if (Number(req.headers["content-length"] || 0) > 8192) return send(res, 413, { error: "too large" });

  let body;
  try {
    const text = await readBody(req);
    if (text.length > 8192) return send(res, 413, { error: "too large" });
    body = JSON.parse(text);
  } catch (e) {
    return send(res, e.status === 413 ? 413 : 400, { error: e.status === 413 ? "too large" : "bad json" });
  }
  const input = validateAsk(body);
  if (!input) return send(res, 400, { error: "bad request" });

  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || "unknown";
  if (!limiter.hit(ip, Date.now()).ok) return send(res, 429, { error: "rate limited" }, { "retry-after": "3600" });

  try {
    const out = await answerQuestion({
      ...input,
      index,
      base: demoBase(process.env.DEMO_BASE),
      apiKey,
      model: process.env.CHAT_MODEL || undefined,
      fallbackModel: process.env.CHAT_FALLBACK_MODEL || undefined,
      onCall: () => limiter.countCall(),
    });
    if (out.busy) return send(res, 429, { error: "busy" }, { "retry-after": "60" });
    return send(res, 200, out);
  } catch {
    return send(res, 502, { error: "upstream" }); // nothing about the question is logged
  }
}
