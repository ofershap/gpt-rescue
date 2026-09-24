// Minimal stateless MCP server over Streamable HTTP (JSON responses).
// Spec: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
import type { Rescue } from "./store.ts";
import { instructionsText, listTools, runTool } from "./tools.ts";

// deno-lint-ignore no-explicit-any
type Json = any;

const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];

function ok(id: Json, result: Json) {
  return { jsonrpc: "2.0", id, result };
}
function err(id: Json, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleOne(r: Rescue, msg: Json): Promise<Json | null> {
  const { id, method, params } = msg ?? {};
  if (typeof method !== "string") return err(id ?? null, -32600, "Invalid request");
  if (id === undefined || id === null) return null; // notification
  switch (method) {
    case "initialize": {
      const asked = params?.protocolVersion;
      return ok(id, {
        protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: r.name.slice(0, 60), version: "1.0.0" },
        instructions: `This server is "${r.name}", a rescued Custom GPT. At the start of every conversation call get_instructions and follow what it returns.`,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, {
        tools: listTools(r).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { readOnlyHint: t.readOnly, openWorldHint: !["get_instructions", "search_knowledge"].includes(t.name) },
        })),
      });
    case "tools/call": {
      try {
        const text = await runTool(r, String(params?.name), params?.arguments ?? {});
        return ok(id, { content: [{ type: "text", text }], isError: false });
      } catch (e) {
        return ok(id, { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true });
      }
    }
    case "prompts/list":
      return ok(id, { prompts: [{ name: "start", description: `Start a conversation with ${r.name}` }] });
    case "prompts/get":
      return ok(id, { description: r.name, messages: [{ role: "user", content: { type: "text", text: instructionsText(r) } }] });
    case "resources/list":
      return ok(id, { resources: [] });
    default:
      return err(id, -32601, `Method not found: ${method}`);
  }
}

export async function handleMcp(r: Rescue, req: Request): Promise<Response> {
  if (req.method === "GET") return new Response("Use POST (stateless Streamable HTTP)", { status: 405, headers: { allow: "POST" } });
  if (req.method === "DELETE") return new Response(null, { status: 204 });
  let body: Json;
  try {
    body = await req.json();
  } catch {
    return Response.json(err(null, -32700, "Parse error"), { status: 400 });
  }
  const batch = Array.isArray(body);
  const results = (await Promise.all((batch ? body : [body]).map((m: Json) => handleOne(r, m)))).filter((x) => x !== null);
  if (!results.length) return new Response(null, { status: 202 });
  return Response.json(batch ? results : results[0]);
}
