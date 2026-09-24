// Persistence on Deno KV. Secrets are sealed before they are written.
import { randomToken, sha256 } from "./crypto.ts";

export type ActionAuth =
  | { type: "none" }
  | { type: "bearer"; sealedToken: string }
  | { type: "header"; headerName: string; sealedValue: string }
  | { type: "query"; paramName: string; sealedValue: string };

export interface Rescue {
  id: string;
  name: string;
  description: string;
  instructions: string;
  openapi: string | null; // raw schema text (JSON or YAML-as-JSON)
  actionAuth: ActionAuth;
  sealedOpenAIKey: string | null; // enables the hosted chat page
  model: string;
  adminHash: string;
  createdAt: string;
  knowledgeFiles: { name: string; chunks: number; chars: number }[];
}

export interface CustomerKey {
  keyHash: string;
  label: string;
  createdAt: string;
  revoked: boolean;
  lastUsed: string | null;
}

export interface Chunk {
  file: string;
  text: string;
}

let kvPromise: Promise<Deno.Kv> | null = null;
export function kv(): Promise<Deno.Kv> {
  if (!kvPromise) kvPromise = Deno.openKv(Deno.env.get("KV_PATH") || undefined);
  return kvPromise;
}

export function newId(): string {
  // short, URL-safe, hard to guess
  return randomToken(8);
}

export async function saveRescue(r: Rescue): Promise<void> {
  await (await kv()).set(["rescue", r.id], r);
}

export async function getRescue(id: string): Promise<Rescue | null> {
  return (await (await kv()).get<Rescue>(["rescue", id])).value;
}

export async function deleteRescue(id: string): Promise<void> {
  const db = await kv();
  for await (const e of db.list({ prefix: ["chunk", id] })) await db.delete(e.key);
  for await (const e of db.list({ prefix: ["ckey", id] })) await db.delete(e.key);
  await db.delete(["rescue", id]);
}

export async function saveChunks(id: string, file: string, chunks: string[]): Promise<void> {
  const db = await kv();
  let i = 0;
  for (const text of chunks) {
    await db.set(["chunk", id, file, i++], { file, text } satisfies Chunk);
  }
}

export async function deleteFileChunks(id: string, file: string): Promise<void> {
  const db = await kv();
  for await (const e of db.list({ prefix: ["chunk", id, file] })) await db.delete(e.key);
}

export async function allChunks(id: string): Promise<Chunk[]> {
  const db = await kv();
  const out: Chunk[] = [];
  for await (const e of db.list<Chunk>({ prefix: ["chunk", id] })) out.push(e.value);
  return out;
}

export async function createCustomerKey(id: string, label: string): Promise<string> {
  const key = "cus_" + randomToken(16);
  const keyHash = await sha256(key);
  const rec: CustomerKey = { keyHash, label, createdAt: new Date().toISOString(), revoked: false, lastUsed: null };
  await (await kv()).set(["ckey", id, keyHash], rec);
  return key;
}

export async function listCustomerKeys(id: string): Promise<CustomerKey[]> {
  const db = await kv();
  const out: CustomerKey[] = [];
  for await (const e of db.list<CustomerKey>({ prefix: ["ckey", id] })) out.push(e.value);
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function setKeyRevoked(id: string, keyHash: string, revoked: boolean): Promise<void> {
  const db = await kv();
  const cur = await db.get<CustomerKey>(["ckey", id, keyHash]);
  if (cur.value) await db.set(["ckey", id, keyHash], { ...cur.value, revoked });
}

/** Returns the key record when the plaintext key is valid and not revoked. */
export async function checkCustomerKey(id: string, key: string): Promise<CustomerKey | null> {
  if (!key || !key.startsWith("cus_")) return null;
  const db = await kv();
  const keyHash = await sha256(key);
  const cur = await db.get<CustomerKey>(["ckey", id, keyHash]);
  if (!cur.value || cur.value.revoked) return null;
  // best-effort usage stamp, at most once per hour to save writes
  const last = cur.value.lastUsed ? Date.parse(cur.value.lastUsed) : 0;
  if (Date.now() - last > 3600_000) {
    await db.set(["ckey", id, keyHash], { ...cur.value, lastUsed: new Date().toISOString() });
  }
  return cur.value;
}

/** Simple fixed-window rate limit. Returns true when the call is allowed. */
export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const db = await kv();
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const k = ["rl", bucket, win];
  const cur = (await db.get<number>(k)).value ?? 0;
  if (cur >= limit) return false;
  await db.set(k, cur + 1, { expireIn: windowSec * 1000 * 2 });
  return true;
}
