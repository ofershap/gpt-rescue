// The tool set a rescued GPT exposes, shared by the MCP connector and the
// hosted chat page so both behave the same.
import { allChunks, type Rescue } from "./store.ts";
import { search } from "./knowledge.ts";
import { callTool, specToTools, type ParsedSpec } from "./openapi.ts";

// deno-lint-ignore no-explicit-any
type Json = any;

export interface ExposedTool {
  name: string;
  description: string;
  inputSchema: Json;
  readOnly: boolean;
}

export function instructionsTool(r: Rescue): ExposedTool {
  return {
    name: "get_instructions",
    description: `Call this FIRST, before answering anything, in every conversation that uses "${r.name}". Returns the operating instructions written by the creator of ${r.name}. Follow them for the rest of the conversation.`,
    inputSchema: { type: "object", properties: {}, required: [] },
    readOnly: true,
  };
}

export function knowledgeTool(r: Rescue): ExposedTool {
  const files = r.knowledgeFiles.map((f) => f.name).join(", ");
  return {
    name: "search_knowledge",
    description: `Search the knowledge files of "${r.name}" (${files}). Use it whenever the answer may be in the creator's material. Returns the most relevant passages with file names.`,
    inputSchema: { type: "object", properties: { query: { type: "string", description: "What to look for, in keywords" } }, required: ["query"] },
    readOnly: true,
  };
}

export function specFor(r: Rescue): ParsedSpec | null {
  if (!r.openapi) return null;
  try {
    return specToTools(r.openapi);
  } catch {
    return null;
  }
}

export function listTools(r: Rescue): ExposedTool[] {
  const out = [instructionsTool(r)];
  if (r.knowledgeFiles.length) out.push(knowledgeTool(r));
  const spec = specFor(r);
  for (const t of spec?.tools ?? []) {
    out.push({ name: t.name, description: t.description, inputSchema: t.inputSchema, readOnly: t.op.method === "GET" });
  }
  return out;
}

export function instructionsText(r: Rescue): string {
  return `You are "${r.name}". ${r.description ? r.description + "\n\n" : ""}Creator instructions:\n\n${r.instructions}`;
}

export async function runTool(r: Rescue, name: string, args: Json): Promise<string> {
  if (name === "get_instructions") return instructionsText(r);
  if (name === "search_knowledge") {
    const hits = search(await allChunks(r.id), String(args?.query ?? ""), 5);
    if (!hits.length) return "No matching passages in the knowledge files.";
    return hits.map((h, i) => `[${i + 1}] (${h.file})\n${h.text}`).join("\n\n---\n\n");
  }
  const spec = specFor(r);
  if (!spec) throw new Error(`Unknown tool: ${name}`);
  const res = await callTool(spec, name, args ?? {}, r.actionAuth);
  return `HTTP ${res.status}\n${res.body}`;
}
