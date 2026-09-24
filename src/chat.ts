// Hosted private chat: runs the rescued GPT on the creator's own OpenAI key.
import type { Rescue } from "./store.ts";
import { open } from "./crypto.ts";
import { instructionsText, listTools, runTool } from "./tools.ts";

// deno-lint-ignore no-explicit-any
type Json = any;

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const MAX_TURNS = 40;
const MAX_TOOL_ROUNDS = 6;

export async function chat(r: Rescue, history: ChatMsg[]): Promise<string> {
  if (!r.sealedOpenAIKey) throw new Error("The creator has not enabled the chat page for this GPT.");
  const key = await open(r.sealedOpenAIKey);
  const tools = listTools(r)
    .filter((t) => t.name !== "get_instructions")
    .map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
  const messages: Json[] = [
    { role: "system", content: instructionsText(r) },
    ...history.slice(-MAX_TURNS).map((m) => ({ role: m.role, content: String(m.content).slice(0, 20_000) })),
  ];
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: r.model, messages, ...(tools.length ? { tools } : {}) }),
      signal: AbortSignal.timeout(90_000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`OpenAI error (${res.status}): ${data?.error?.message ?? "unknown"}`);
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("Empty response from OpenAI");
    if (!msg.tool_calls?.length) return msg.content ?? "";
    messages.push(msg);
    for (const call of msg.tool_calls) {
      let out: string;
      try {
        out = await runTool(r, call.function.name, JSON.parse(call.function.arguments || "{}"));
      } catch (e) {
        out = `Error: ${(e as Error).message}`;
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: out.slice(0, 30_000) });
    }
  }
  return "Sorry, that took too many steps. Please try a simpler request.";
}

/** Validates an OpenAI key by listing models. Returns an error message or null. */
export async function validateOpenAIKey(key: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
    if (res.ok) return null;
    const d = await res.json().catch(() => ({}));
    return `OpenAI rejected the key (${res.status}): ${d?.error?.message ?? ""}`;
  } catch (e) {
    return `Could not reach OpenAI: ${(e as Error).message}`;
  }
}
