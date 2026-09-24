// Knowledge files: text extraction, chunking and keyword (BM25) search.
// No embeddings on purpose: zero cost, no extra API key, good enough for
// the size of knowledge a Custom GPT carries.
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|html?|xml|ya?ml)$/i;

export async function fileToText(name: string, bytes: Uint8Array): Promise<string> {
  if (/\.pdf$/i.test(name)) {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: false });
    return (text as string[]).map((t, i) => `[page ${i + 1}]\n${t}`).join("\n\n");
  }
  if (TEXT_EXT.test(name)) {
    let t = new TextDecoder().decode(bytes);
    if (/\.html?$/i.test(name)) t = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
    return t;
  }
  throw new Error(`Unsupported file type: ${name}. Use PDF, TXT, MD, CSV, JSON or HTML (export Word/Docs files to PDF).`);
}

export function chunkText(text: string, size = 1800, overlap = 200): string[] {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(clean.length, i + size);
    if (end < clean.length) {
      const para = clean.lastIndexOf("\n\n", end);
      const sent = clean.lastIndexOf(". ", end);
      const cut = para > i + size * 0.5 ? para : sent > i + size * 0.5 ? sent + 1 : end;
      end = cut;
    }
    out.push(clean.slice(i, end).trim());
    if (end >= clean.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return out.filter(Boolean);
}

const tokenize = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1).map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));

export function search<T extends { text: string }>(chunks: T[], query: string, k = 5): T[] {
  const q = [...new Set(tokenize(query))];
  if (!q.length || !chunks.length) return [];
  const docs = chunks.map((c) => tokenize(c.text));
  const avg = docs.reduce((a, d) => a + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length, k1 = 1.4, b = 0.75;
  const scored = docs.map((d, idx) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let s = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.length / avg));
    }
    return { idx, s };
  });
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map((x) => chunks[x.idx]);
}
