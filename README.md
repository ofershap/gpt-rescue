# 🛟 GPT Rescue

OpenAI is retiring Custom GPTs in favor of plugins. The migration keeps your instructions and files, but not your share links, your custom actions, or your customers' access ([OpenAI FAQ](https://help.openai.com/en/articles/20001519-custom-gpt-retirement-and-migration-faq)).

GPT Rescue takes what you paste from your GPT's editor and gives you back:

1. **A connector (MCP server)** your customers add to ChatGPT (Developer mode → custom app/plugin). It loads your instructions, searches your knowledge files and calls your actions. It runs on the customer's own ChatGPT plan. Also works in Claude, Cursor and any MCP client.
2. **A private chat page** with a stable link, running on your own OpenAI API key.
3. **Per-customer access keys** you can revoke at any time.

Free, open source, no build step.

## How it works

- Instructions are served through a `get_instructions` tool and the MCP `instructions` field.
- Knowledge files (PDF, TXT, MD, CSV, JSON, HTML) are split into passages and searched with BM25. No embeddings, no extra API key.
- Each operation in your OpenAPI 3.x action schema becomes a tool. Calls go to your real API with your key (bearer, custom header or query parameter), stored AES-GCM encrypted.
- The connector is a stateless MCP Streamable HTTP endpoint at `/mcp/:gptId/:customerKey`.
- The chat page calls OpenAI Chat Completions with the same tools. Conversations stay in the customer's browser.

## Run it yourself

Requires [Deno](https://deno.com) 2.x.

```bash
export MASTER_KEY=$(openssl rand -base64 32)   # keep it, it decrypts stored secrets
deno task dev
```

Env vars: `MASTER_KEY` (required), `PUBLIC_URL` (optional, used in generated links), `KV_PATH` (optional local KV file).

Deploys as-is to Deno Deploy (Deno KV is built in).

## Code map

| File | What |
| --- | --- |
| `src/app.ts` | HTTP routes (Hono) |
| `src/mcp.ts` | MCP JSON-RPC handler |
| `src/tools.ts` | Tool set shared by the connector and chat |
| `src/openapi.ts` | OpenAPI → tools, and calling the real API |
| `src/knowledge.ts` | File text extraction, chunking, BM25 search |
| `src/chat.ts` | Hosted chat on the creator's OpenAI key |
| `src/store.ts` | Deno KV storage |
| `src/pages.ts` | Landing, create, admin and chat pages |

## Roadmap

- Stripe paywall per customer
- OAuth for the connector (so customers don't paste a URL with a key)
- Import from a GPT export

Not affiliated with OpenAI. MIT license.
