import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSearchResponse, requestSearch } from "../lib/knowledge-base";

test("normalizes the DNotifier data.rows response and keeps source record IDs", () => {
  const result = normalizeSearchResponse({
    data: {
      rows: [{
        id: "chunk-1",
        document_id: "document-uuid",
        content: "  Fee is a fictional demo value.  ",
        metadata: { source: "noor-academy" },
        similarity: 0.91,
      }],
    },
  });

  assert.equal(result.outcome, "hits-with-content");
  assert.equal(result.returnedHits, 1);
  assert.deepEqual(result.hits[0], {
    documentId: "document-uuid",
    chunkId: "chunk-1",
    source: "noor-academy",
    content: "Fee is a fictional demo value.",
    similarity: 0.91,
  });
});

test("accepts a raw hit array for backward-compatible test doubles", () => {
  const result = normalizeSearchResponse([{ content: "supported fact" }]);
  assert.equal(result.outcome, "hits-with-content");
  assert.equal(result.hits[0].content, "supported fact");
});

test("distinguishes zero results from malformed search responses", () => {
  assert.equal(normalizeSearchResponse({ data: { rows: [] } }).outcome, "zero-hits");
  assert.equal(normalizeSearchResponse({ data: {} }).outcome, "malformed-response");
  assert.equal(normalizeSearchResponse(null).outcome, "malformed-response");
});

test("rejects empty, whitespace-only, and incorrectly shaped content", () => {
  const result = normalizeSearchResponse({
    data: {
      rows: [
        { content: "" },
        { content: " \n " },
        { content: 42 },
        null,
      ],
    },
  });
  assert.equal(result.outcome, "hits-without-content");
  assert.equal(result.returnedHits, 4);
  assert.equal(result.hits.length, 0);
});

test("deduplicates repeated chunks but retains distinct chunks from the same document", () => {
  const result = normalizeSearchResponse({
    data: {
      rows: [
        { document_id: "doc-1", id: "chunk-1", content: "course names" },
        { document_id: "doc-1", id: "chunk-2", content: "course names" },
        { document_id: "doc-1", id: "chunk-3", content: "online format" },
      ],
    },
  });
  assert.equal(result.hits.length, 2);
  assert.deepEqual(result.hits.map((hit) => hit.content), ["course names", "online format"]);
});

test("records an SDK search failure without exposing its message", async () => {
  const result = await requestSearch(async () => {
    throw new Error("private request URL and credential must not be logged");
  });
  assert.equal(result.outcome, "request-error");
  assert.equal(result.errorName, "Error");
  assert.equal(result.hits.length, 0);
});

test("does not report a successful result when the search promise fails", async () => {
  const result = await requestSearch(async () => {
    throw new TypeError("offline");
  });
  assert.equal(result.outcome, "request-error");
  assert.equal(result.errorName, "TypeError");
});
