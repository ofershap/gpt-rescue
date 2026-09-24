import { Hono, type Context } from "hono";
import { randomToken, safeEqual, seal, sha256 } from "./crypto.ts";
import {
  checkCustomerKey, createCustomerKey, deleteFileChunks, deleteRescue, getRescue, listCustomerKeys,
  newId, rateLimit, saveChunks, saveRescue, setKeyRevoked, type ActionAuth, type Rescue,
} from "./store.ts";
import { chunkText, fileToText, MAX_FILE_BYTES } from "./knowledge.ts";
import { specToTools } from "./openapi.ts";
import { handleMcp } from "./mcp.ts";
import { chat, validateOpenAIKey, type ChatMsg } from "./chat.ts";
import { adminPage, chatPage, landingPage, newPage, notFoundPage } from "./pages.ts";
import { listTools } from "./tools.ts";

export const app = new Hono();

const MAX_FILES = 20;
const MAX_TOTAL_CHARS = 3_000_000;

const ip = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0].trim() || "unknown";
const origin = (c: Context) => Deno.env.get("PUBLIC_URL") || new URL(c.req.url).origin;

app.use("*", async (c, next) => {
  await next();
  c.header("x-content-type-options", "nosniff");
  c.header("referrer-policy", "no-referrer");
});

app.get("/", (c) => c.html(landingPage()));
app.get("/new", (c) => c.html(newPage()));
app.get("/admin/:id", (c) => c.html(adminPage()));
app.get("/c/:id", async (c) => {
  const r = await getRescue(c.req.param("id"));
  if (!r) return c.html(notFoundPage(), 404);
  return c.html(chatPage(r.name, r.description, !!r.sealedOpenAIKey));
});
app.get("/healthz", (c) => c.text("ok"));

async function requireAdmin(c: Context): Promise<Rescue | Response> {
  const r = await getRescue(c.req.param("id") ?? "");
  const token = c.req.header("x-admin-token") ?? "";
  if (!r || !token || !safeEqual(await sha256(token), r.adminHash)) return c.json({ error: "Not found or wrong admin token" }, 404);
  return r;
}

async function readAuth(form: FormData, current: ActionAuth): Promise<ActionAuth> {
  const type = String(form.get("authType") ?? "");
  const name = String(form.get("authName") ?? "").trim();
  const value = String(form.get("authValue") ?? "").trim();
  if (!type || type === "keep") return current;
  if (type === "none") return { type: "none" };
  if (!value) throw new Error("Enter the API key / token for your action");
  if (type === "bearer") return { type: "bearer", sealedToken: await seal(value) };
  if (type === "header") {
    if (!/^[A-Za-z0-9-]+$/.test(name)) throw new Error("Enter a valid header name, e.g. X-API-Key");
    return { type: "header", headerName: name, sealedValue: await seal(value) };
  }
  if (type === "query") {
    if (!name) throw new Error("Enter the query parameter name");
    return { type: "query", paramName: name, sealedValue: await seal(value) };
  }
  throw new Error("Unknown auth type");
}

async function ingestFiles(r: Rescue, form: FormData) {
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  let total = r.knowledgeFiles.reduce((a, f) => a + f.chars, 0);
  for (const f of files) {
    if (r.knowledgeFiles.length >= MAX_FILES) throw new Error(`At most ${MAX_FILES} files`);
    if (f.size > MAX_FILE_BYTES) throw new Error(`${f.name} is larger than 8 MB`);
    const name = f.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120);
    const text = await fileToText(name, new Uint8Array(await f.arrayBuffer()));
    if (!text.trim()) throw new Error(`${name}: no text found (scanned PDFs need OCR first)`);
    total += text.length;
    if (total > MAX_TOTAL_CHARS) throw new Error("Knowledge files are too large in total (3M characters max)");
    const chunks = chunkText(text);
    await deleteFileChunks(r.id, name);
    await saveChunks(r.id, name, chunks);
    r.knowledgeFiles = r.knowledgeFiles.filter((k) => k.name !== name);
    r.knowledgeFiles.push({ name, chunks: chunks.length, chars: text.length });
  }
}

async function applyCommon(r: Rescue, form: FormData) {
  const get = (k: string) => (form.has(k) ? String(form.get(k) ?? "") : null);
  const name = get("name"), description = get("description"), instructions = get("instructions"), openapi = get("openapi"), model = get("model");
  if (name !== null) r.name = name.trim().slice(0, 80);
  if (description !== null) r.description = description.trim().slice(0, 500);
  if (instructions !== null) r.instructions = instructions.slice(0, 16_000);
  if (model !== null && model.trim()) r.model = model.trim().slice(0, 60);
  if (openapi !== null) {
    const t = openapi.trim();
    if (t) specToTools(t); // throws a readable error when the schema is unusable
    r.openapi = t || null;
  }
  r.actionAuth = await readAuth(form, r.actionAuth);
  const key = get("openaiKey");
  if (key !== null && key.trim()) {
    if (key.trim() === "remove") r.sealedOpenAIKey = null;
    else {
      const bad = await validateOpenAIKey(key.trim());
      if (bad) throw new Error(bad);
      r.sealedOpenAIKey = await seal(key.trim());
    }
  }
  if (!r.name) throw new Error("Give your GPT a name");
  if (!r.instructions.trim()) throw new Error("Paste your GPT's instructions");
  await ingestFiles(r, form);
}

app.post("/api/rescues", async (c) => {
  if (!(await rateLimit(`create:${ip(c)}`, 10, 3600))) return c.json({ error: "Too many new GPTs from this address, try again in an hour" }, 429);
  try {
    const form = await c.req.formData();
    const adminToken = "adm_" + randomToken(20);
    const r: Rescue = {
      id: newId(), name: "", description: "", instructions: "", openapi: null, actionAuth: { type: "none" },
      sealedOpenAIKey: null, model: "gpt-4.1-mini", adminHash: await sha256(adminToken),
      createdAt: new Date().toISOString(), knowledgeFiles: [],
    };
    await applyCommon(r, form);
    await saveRescue(r);
    return c.json({ id: r.id, adminToken });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

function publicView(c: Context, r: Rescue) {
  let spec: { title: string; baseUrl: string } | null = null;
  try {
    if (r.openapi) spec = specToTools(r.openapi);
  } catch { /* ignore */ }
  return {
    id: r.id, name: r.name, description: r.description, instructions: r.instructions, openapi: r.openapi ?? "",
    model: r.model, chatEnabled: !!r.sealedOpenAIKey, actionAuthType: r.actionAuth.type,
    actionAuthName: r.actionAuth.type === "header" ? r.actionAuth.headerName : r.actionAuth.type === "query" ? r.actionAuth.paramName : "",
    knowledgeFiles: r.knowledgeFiles, api: spec ? { title: spec.title, baseUrl: spec.baseUrl } : null,
    tools: listTools(r).map((t) => ({ name: t.name, description: t.description })),
    origin: origin(c),
  };
}

app.get("/api/rescues/:id", async (c) => {
  const r = await requireAdmin(c);
  if (r instanceof Response) return r;
  return c.json({ ...publicView(c, r), keys: await listCustomerKeys(r.id) });
});

app.post("/api/rescues/:id", async (c) => {
  const r = await requireAdmin(c);
  if (r instanceof Response) return r;
  try {
    await applyCommon(r, await c.req.formData());
    await saveRescue(r);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

app.delete("/api/rescues/:id/files/:name", async (c) => {
  const r = await requireAdmin(c);
  if (r instanceof Response) return r;
  const name = c.req.param("name");
  await deleteFileChunks(r.id, name);
  r.knowledgeFiles = r.knowledgeFiles.filter((f) => f.name !== name);
  await saveRescue(r);
  return c.json({ ok: true });
});

app.delete("/api/rescues/:id", async (c) => {
  const r = await requireAdmin(c);
  if (r instanceof Response) return r;
  await deleteRescue(r.id);
  return c.json({ ok: true });
});

app.post("/api/rescues/:id/keys", async (c) => {
  const r = await requireAdmin(c);
  if (r instanceof Response) return r;
  const { label } = await c.req.json().catch(() => ({ label: "" }));
  const keys = await listCustomerKeys(r.id);
  if (keys.length >= 500) return c.json({ error: "Key limit reached (500)" }, 400);
  const key = await createCustomerKey(r.id, String(label || "Customer").slice(0, 80));
  const o = origin(c);
  return c.json({ key, connectorUrl: `${o}/mcp/${r.id}/${key}`, chatUrl: `${o}/c/${r.id}#k=${key}` });
});

app.post("/api/rescues/:id/keys/:hash", async (c) => {
  const r = await requireAdmin(c);
  if (r instanceof Response) return r;
  const { revoked } = await c.req.json().catch(() => ({ revoked: true }));
  await setKeyRevoked(r.id, c.req.param("hash"), !!revoked);
  return c.json({ ok: true });
});

// MCP connector: the customer key in the path is the credential.
app.all("/mcp/:id/:key", async (c) => {
  const r = await getRescue(c.req.param("id"));
  const key = c.req.param("key");
  if (!r || !(await checkCustomerKey(r.id, key))) return c.json({ error: "Unknown connector or revoked key" }, 401);
  if (!(await rateLimit(`mcp:${await sha256(key)}`, 600, 3600))) return c.json({ error: "Rate limit" }, 429);
  return handleMcp(r, c.req.raw);
});

app.post("/api/chat/:id", async (c) => {
  const r = await getRescue(c.req.param("id"));
  const key = c.req.header("x-customer-key") ?? "";
  if (!r || !(await checkCustomerKey(r.id, key))) return c.json({ error: "This access link is not valid. Ask the creator for a new one." }, 401);
  if (!(await rateLimit(`chat:${await sha256(key)}`, 120, 3600))) return c.json({ error: "Too many messages this hour, try again later" }, 429);
  try {
    const { messages } = await c.req.json();
    if (!Array.isArray(messages) || !messages.length) return c.json({ error: "No messages" }, 400);
    const history: ChatMsg[] = messages
      .filter((m: ChatMsg) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m: ChatMsg) => ({ role: m.role, content: m.content }));
    return c.json({ reply: await chat(r, history) });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

app.notFound((c) => c.html(notFoundPage(), 404));
