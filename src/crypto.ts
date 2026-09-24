// AES-GCM encryption for secrets (creator API keys, action credentials).
// MASTER_KEY: a base64 32-byte key, or any random secret of 16+ characters.

const enc = new TextEncoder();
const dec = new TextDecoder();

let cached: CryptoKey | null = null;

async function masterKey(): Promise<CryptoKey> {
  if (cached) return cached;
  const secret = (Deno.env.get("MASTER_KEY") ?? "").trim();
  if (secret.length < 16) throw new Error("MASTER_KEY env var is missing or too short (use 16+ random characters)");
  // A base64 32-byte key is used as-is; any other secret is stretched with SHA-256.
  let raw: Uint8Array<ArrayBuffer> | null = null;
  try {
    const d = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
    if (d.length === 32) raw = d;
  } catch { /* not base64 */ }
  if (!raw) raw = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(secret)));
  cached = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  return cached;
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function seal(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await masterKey(), enc.encode(plain)));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function open(sealed: string): Promise<string> {
  const [iv, ct] = sealed.split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await masterKey(), unb64(ct));
  return dec.decode(pt);
}

export function randomToken(bytes = 24): string {
  const u = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(s: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string compare for equal-length hex digests. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
