// Shared by the chat tests: the committed demo index and a fake Groq that never touches the network.
import fs from "node:fs";
import { createIndex } from "../api/_ask.js";

export const raw = JSON.parse(fs.readFileSync(new URL("../api/_chat/demo.json", import.meta.url), "utf8"));
export const index = createIndex(raw);

// script = list of assistant messages (or a function of the request body); records every request in .calls
export function fakeGroq(script) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const step = typeof script === "function" ? script(body, calls.length - 1) : script[Math.min(calls.length - 1, script.length - 1)];
    if (step?.status) return new Response(JSON.stringify(step.json || {}), { status: step.status });
    return new Response(JSON.stringify({ choices: [{ message: step }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}
export const say = (content) => ({ role: "assistant", content });
export const callTool = (name, args, id = "c1") => ({ role: "assistant", content: "", tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
