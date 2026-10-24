import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DNotifier } from "@dnotifier-realtime/dnotifier";
import {
  EMPTY_RESULT_FALLBACK_MIN_SIMILARITY,
  PRIMARY_SEARCH_MIN_SIMILARITY,
  SEARCH_LIMIT,
} from "../lib/knowledge-base";
import { retrievalCases } from "./retrieval-eval-dataset";

const SENDER_ID = "support-backend";
const SOURCE = "noor-academy";
const K = SEARCH_LIMIT;
const PAGE_SIZE = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function documentRows(response: unknown): Record<string, unknown>[] {
  if (!isRecord(response) || !isRecord(response.data) || !Array.isArray(response.data.rows)) {
    throw new Error("DNotifier returned an invalid document-list response.");
  }
  return response.data.rows.filter(isRecord);
}

function searchRows(response: unknown): Record<string, unknown>[] {
  if (!isRecord(response) || !isRecord(response.data) || !Array.isArray(response.data.rows)) {
    throw new Error("DNotifier returned an invalid search response.");
  }
  if (!response.data.rows.every(isRecord)) {
    throw new Error("DNotifier returned a malformed search row.");
  }
  return response.data.rows;
}

async function main() {
  const appId = process.env.DNOTIFIER_APP_ID;
  const secret = process.env.DNOTIFIER_SECRET;
  if (!appId || !secret) {
    throw new Error("Set DNOTIFIER_APP_ID and DNOTIFIER_SECRET in .env.local.");
  }

  const notifier = new DNotifier({
    appId,
    secret,
    transport: "http",
    userId: SENDER_ID,
    logs: false,
    url: undefined,
    onConnected: () => {},
    onMessage: () => {},
    onDisconnected: () => {},
    WebSocketImpl: undefined,
  });
  await notifier.connect();

  const idByUuid = new Map<string, string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response: unknown = await notifier.listDocuments({
      senderId: SENDER_ID,
      limit: PAGE_SIZE,
      offset,
      type: "text",
    });
    const rows = documentRows(response);
    for (const row of rows) {
      if (typeof row.id === "string" && typeof row.record_id === "string") {
        idByUuid.set(row.id, row.record_id);
      }
    }
    if (rows.length < PAGE_SIZE) break;
  }

  let expectedDocQueries = 0;
  let recallTotal = 0;
  let precisionTotal = 0;
  let precisionQueries = 0;
  let noResultCount = 0;
  let errorCount = 0;
  let rawHitCount = 0;
  let emptyContentCount = 0;
  let latencyTotal = 0;
  let searchQueryCount = 0;
  let searchCallCount = 0;
  let fallbackSearchCount = 0;

  for (const testCase of retrievalCases) {
    if (testCase.expectedBehavior === "general") {
      console.log(JSON.stringify({
        id: testCase.id,
        topic: testCase.topic,
        expectedBehavior: testCase.expectedBehavior,
        searchPerformed: false,
      }));
      continue;
    }
    searchQueryCount++;
    const queryStartedAt = Date.now();
    let thresholdUsed = PRIMARY_SEARCH_MIN_SIMILARITY;
    try {
      searchCallCount++;
      let response: unknown = await notifier.search({
        senderId: SENDER_ID,
        query: testCase.query,
        limit: K,
        minSimilarity: PRIMARY_SEARCH_MIN_SIMILARITY,
        filterbySource: SOURCE,
      });
      let rows = searchRows(response);
      if (rows.length === 0) {
        fallbackSearchCount++;
        searchCallCount++;
        thresholdUsed = EMPTY_RESULT_FALLBACK_MIN_SIMILARITY;
        response = await notifier.search({
          senderId: SENDER_ID,
          query: testCase.query,
          limit: K,
          minSimilarity: EMPTY_RESULT_FALLBACK_MIN_SIMILARITY,
          filterbySource: SOURCE,
        });
        rows = searchRows(response);
      }
      const latencyMs = Date.now() - queryStartedAt;
      latencyTotal += latencyMs;
      rawHitCount += rows.length;
      emptyContentCount += rows.filter(
        (row) => typeof row.content !== "string" || row.content.trim().length === 0,
      ).length;
      if (rows.length === 0) noResultCount++;

      const returnedIds = [...new Set(rows.flatMap((row) => {
        const uuid = typeof row.document_id === "string" ? row.document_id : "";
        const stableId = idByUuid.get(uuid)
          ?? (typeof row.record_id === "string" ? row.record_id : "");
        return stableId ? [stableId] : [];
      }))].slice(0, K);
      const expected = new Set(testCase.expectedDocumentIds);
      const relevantCount = returnedIds.filter((id) => expected.has(id)).length;
      if (expected.size > 0) {
        expectedDocQueries++;
        recallTotal += relevantCount / expected.size;
      }
      if (returnedIds.length > 0) {
        precisionQueries++;
        precisionTotal += relevantCount / returnedIds.length;
      } else if (expected.size === 0) {
        precisionQueries++;
        precisionTotal += 1;
      }

      console.log(JSON.stringify({
        id: testCase.id,
        topic: testCase.topic,
        expectedDocumentIds: testCase.expectedDocumentIds,
        requiredEvidence: testCase.requiredEvidence,
        sufficientEvidence: testCase.sufficientEvidence,
        expectedBehavior: testCase.expectedBehavior,
        retrievedDocumentIds: returnedIds,
        relevantCount,
        thresholdUsed,
        fallbackUsed: thresholdUsed !== PRIMARY_SEARCH_MIN_SIMILARITY,
        latencyMs,
      }));
    } catch (error) {
      errorCount++;
      latencyTotal += Date.now() - queryStartedAt;
      console.error(JSON.stringify({
        id: testCase.id,
        topic: testCase.topic,
        errorName: error instanceof Error ? error.name : "UnknownError",
      }));
    }
  }

  console.log(JSON.stringify({
    summary: {
      queryCount: retrievalCases.length,
      businessSearchQueryCount: searchQueryCount,
      searchCallCount,
      fallbackSearchCount,
      k: K,
      recallAtK: expectedDocQueries ? recallTotal / expectedDocQueries : null,
      precisionAtK: precisionQueries ? precisionTotal / precisionQueries : null,
      noResultRate: noResultCount / searchQueryCount,
      emptyContentRate: rawHitCount ? emptyContentCount / rawHitCount : 0,
      searchErrorRate: errorCount / searchQueryCount,
      meanLatencyMs: Math.round(latencyTotal / searchQueryCount),
      note: "Recall averages business-search queries with an expected source document. Precision averages returned unique source documents; queries expected to have no KB source count as precise only when no documents are returned. Queries with zero primary results use the same lower-threshold fallback as the workflow.",
    },
  }));

  if (errorCount > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Retrieval evaluation failed:", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
