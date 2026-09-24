// Converts a Custom GPT action schema (OpenAPI 3.x, JSON or YAML) into
// tool definitions, and executes tool calls against the real API.
import { parse as parseYaml } from "yaml";
import type { ActionAuth } from "./store.ts";
import { open } from "./crypto.ts";

// deno-lint-ignore no-explicit-any
type Json = any;

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Json; // JSON Schema object
  op: { method: string; path: string; params: { name: string; in: string; required: boolean }[]; hasBody: boolean; bodyType: string };
}

export interface ParsedSpec {
  baseUrl: string;
  title: string;
  tools: ToolDef[];
}

export function parseSpec(raw: string): Json {
  const t = raw.trim();
  const doc = t.startsWith("{") ? JSON.parse(t) : parseYaml(t);
  if (!doc || typeof doc !== "object") throw new Error("Schema is not a JSON/YAML object");
  if (!String(doc.openapi ?? "").startsWith("3")) throw new Error("Only OpenAPI 3.x schemas are supported (that is what GPT actions use)");
  return doc;
}

function resolveRefs(node: Json, root: Json, depth = 0): Json {
  if (depth > 12 || node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => resolveRefs(n, root, depth + 1));
  if (typeof node.$ref === "string" && node.$ref.startsWith("#/")) {
    const target = node.$ref.slice(2).split("/").reduce((o: Json, k: string) => o?.[k.replace(/~1/g, "/").replace(/~0/g, "~")], root);
    return resolveRefs(target ?? {}, root, depth + 1);
  }
  const out: Json = {};
  for (const [k, v] of Object.entries(node)) out[k] = resolveRefs(v, root, depth + 1);
  return out;
}

const safeName = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 60);

export function specToTools(raw: string): ParsedSpec {
  const doc = parseSpec(raw);
  const baseUrl = String(doc.servers?.[0]?.url ?? "").replace(/\/$/, "");
  if (!/^https:\/\//.test(baseUrl)) throw new Error("Schema needs servers[0].url with an https:// address");
  const tools: ToolDef[] = [];
  const seen = new Set<string>();
  for (const [path, item] of Object.entries<Json>(doc.paths ?? {})) {
    const shared = (item.parameters ?? []) as Json[];
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const op = item[method];
      if (!op) continue;
      let name = safeName(op.operationId || `${method}_${path}`);
      while (seen.has(name)) name += "_";
      seen.add(name);
      const params = resolveRefs([...shared, ...(op.parameters ?? [])], doc) as Json[];
      const properties: Json = {};
      const required: string[] = [];
      for (const p of params) {
        if (!["path", "query", "header"].includes(p.in)) continue;
        properties[p.name] = { ...(p.schema ?? { type: "string" }), description: p.description ?? undefined };
        if (p.required || p.in === "path") required.push(p.name);
      }
      let hasBody = false, bodyType = "application/json";
      const content = resolveRefs(op.requestBody, doc)?.content;
      if (content) {
        bodyType = content["application/json"] ? "application/json" : Object.keys(content)[0];
        const schema = content[bodyType]?.schema;
        if (schema) {
          hasBody = true;
          properties.body = { ...schema, description: schema.description ?? "Request body" };
          if (resolveRefs(op.requestBody, doc)?.required) required.push("body");
        }
      }
      tools.push({
        name,
        description: String(op.description || op.summary || `${method.toUpperCase()} ${path}`).slice(0, 1000),
        inputSchema: { type: "object", properties, required },
        op: { method: method.toUpperCase(), path, params: params.map((p) => ({ name: p.name, in: p.in, required: !!p.required })), hasBody, bodyType },
      });
    }
  }
  if (!tools.length) throw new Error("No operations found under paths");
  return { baseUrl, title: String(doc.info?.title ?? "API"), tools };
}

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (/^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  return false;
}

export async function callTool(spec: ParsedSpec, toolName: string, args: Json, auth: ActionAuth): Promise<{ status: number; body: string }> {
  const tool = spec.tools.find((t) => t.name === toolName);
  if (!tool) throw new Error(`Unknown action: ${toolName}`);
  let path = tool.op.path;
  const url = new URL(spec.baseUrl);
  const headers: Record<string, string> = { accept: "application/json, text/plain;q=0.9, */*;q=0.5" };
  for (const p of tool.op.params) {
    const v = args?.[p.name];
    if (v === undefined || v === null) {
      if (p.in === "path") throw new Error(`Missing path parameter ${p.name}`);
      continue;
    }
    if (p.in === "path") path = path.replace(`{${p.name}}`, encodeURIComponent(String(v)));
    else if (p.in === "query") url.searchParams.append(p.name, typeof v === "object" ? JSON.stringify(v) : String(v));
    else if (p.in === "header") headers[p.name] = String(v);
  }
  url.pathname = (url.pathname.replace(/\/$/, "") + path).replace(/\/{2,}/g, "/");
  if (url.protocol !== "https:" || isBlockedHost(url.hostname)) throw new Error("Action URL must be a public https address");

  if (auth.type === "bearer") headers.authorization = `Bearer ${await open(auth.sealedToken)}`;
  else if (auth.type === "header") headers[auth.headerName] = await open(auth.sealedValue);
  else if (auth.type === "query") url.searchParams.set(auth.paramName, await open(auth.sealedValue));

  let body: string | undefined;
  if (tool.op.hasBody && args?.body !== undefined) {
    headers["content-type"] = tool.op.bodyType;
    body = typeof args.body === "string" ? args.body : JSON.stringify(args.body);
  }
  const res = await fetch(url, { method: tool.op.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(25_000) });
  const text = await res.text();
  return { status: res.status, body: text.length > 60_000 ? text.slice(0, 60_000) + "\n...[truncated]" : text };
}
