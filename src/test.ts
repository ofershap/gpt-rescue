import { assertEquals } from "jsr:@std/assert@1";
import { chunkText, search } from "./knowledge.ts";
import { specToTools } from "./openapi.ts";

Deno.test("openapi to tools", () => {
  const s = specToTools(`openapi: 3.1.0
info: {title: T, version: "1"}
servers: [{url: https://api.example.com/v1}]
paths:
  /items/{id}:
    get:
      operationId: getItem
      parameters: [{name: id, in: path, required: true, schema: {type: string}}]`);
  assertEquals(s.baseUrl, "https://api.example.com/v1");
  assertEquals(s.tools[0].name, "getItem");
  assertEquals(s.tools[0].inputSchema.required, ["id"]);
});

Deno.test("search finds the right chunk", () => {
  const chunks = [{ text: "Refunds within 14 days" }, { text: "We ship to Europe" }];
  assertEquals(search(chunks, "refund policy")[0].text, "Refunds within 14 days");
  assertEquals(chunkText("a".repeat(5000)).length > 1, true);
});
