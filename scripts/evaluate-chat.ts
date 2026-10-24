import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DNotifier } from "@dnotifier-realtime/dnotifier";
import { supportWorkflow } from "../lib/workflow";
import { chatEvalCases, type ChatEvalCase } from "./chat-eval-dataset";

const SENDER_ID = "support-backend";
const SOURCE = "noor-academy";
const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

interface EvaluationTrace {
  classifiedIntent?: unknown;
  intent?: unknown;
  searchOutcome?: unknown;
  threshold?: unknown;
  sourceDocumentIds?: unknown;
}

interface ChatResult {
  intent: string;
  reply: string;
  lead?: unknown;
  evaluationTrace?: EvaluationTrace;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseRows(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value) || !isRecord(value.data) || !Array.isArray(value.data.rows)) {
    throw new Error("DNotifier returned an invalid document-list response.");
  }
  return value.data.rows.filter(isRecord);
}

function parseWorkflowResult(value: unknown): ChatResult | null {
  if (!isRecord(value) || typeof value.intent !== "string" || typeof value.reply !== "string") {
    return null;
  }
  return {
    intent: value.intent,
    reply: value.reply,
    lead: value.lead,
    evaluationTrace: isRecord(value.evaluationTrace)
      ? value.evaluationTrace as EvaluationTrace
      : undefined,
  };
}

function missingAnswerChecks(testCase: ChatEvalCase, answer: string): string[] {
  const lowered = answer.toLocaleLowerCase();
  return testCase.answerTermGroups.flatMap((group, index) =>
    group.some((term) => lowered.includes(term.toLocaleLowerCase()))
      ? []
      : [`answer term group ${index + 1}: ${group.join(" OR ")}`],
  );
}

function validateCase(
  testCase: ChatEvalCase,
  result: ChatResult | null,
  idByUuid: Map<string, string>,
): string[] {
  if (!result) return ["malformed workflow result"];
  const trace = result.evaluationTrace;
  const failures: string[] = [];
  if (result.intent !== testCase.expectedIntent) {
    failures.push(`intent expected ${testCase.expectedIntent}, got ${result.intent}`);
  }

  const uuidIds = Array.isArray(trace?.sourceDocumentIds)
    ? trace.sourceDocumentIds.filter((id): id is string => typeof id === "string")
    : [];
  const sourceIds = [...new Set(uuidIds.map((id) => idByUuid.get(id) ?? id))];
  const missingSources = testCase.requiredSourceIds.filter((id) => !sourceIds.includes(id));
  if (missingSources.length > 0) {
    failures.push(`missing expected source IDs: ${missingSources.join(", ")}`);
  }

  if (testCase.behavior === "general" && trace?.searchOutcome !== "not-run") {
    failures.push(`general question unexpectedly searched business KB: ${String(trace?.searchOutcome)}`);
  }
  if (testCase.behavior === "lead" || testCase.behavior === "human") {
    if (!isRecord(result.lead)) failures.push("expected workflow lead extraction object");
    else {
      const lead = result.lead;
      if (!["name", "contact", "need", "urgency"].every((key) => key in lead)) {
        failures.push("lead extraction object is missing expected fields");
      }
    }
  }
  if (testCase.behavior === "handoff" || testCase.behavior === "partial" || testCase.behavior === "human") {
    if (!/\b(?:human|representative|support|confirm\w*|verif\w*|not specif\w*|not document\w*|team|contact|refer\w*|does not specif\w*|reach directly)\b/i.test(result.reply)) {
      failures.push("response did not clearly communicate uncertainty or human follow-up");
    }
  }
  failures.push(...missingAnswerChecks(testCase, result.reply));

  for (const pattern of testCase.forbiddenPatterns ?? []) {
    if (new RegExp(pattern, "i").test(result.reply)) {
      failures.push(`response matched forbidden pattern: ${pattern}`);
    }
  }
  return failures;
}

function stableSourceIds(result: ChatResult | null, idByUuid: Map<string, string>): string[] {
  const ids = result?.evaluationTrace?.sourceDocumentIds;
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.flatMap((id) => {
    if (typeof id !== "string") return [];
    return [idByUuid.get(id) ?? id];
  }))];
}

function newSessionId(testId: string): string {
  return `chat-eval-${testId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function verifyApiLeadPersistence(
  testCase: ChatEvalCase,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<string[]> {
  const sessionId = newSessionId(testCase.id);
  const failures: string[] = [];
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  };
  const rowUrl = new URL("/rest/v1/leads", supabaseUrl);
  rowUrl.searchParams.set("select", "session_id,intent,status");
  rowUrl.searchParams.set("session_id", `eq.${sessionId}`);
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message: testCase.message }),
    });
    const body: unknown = await response.json();
    if (!response.ok || !isRecord(body) || body.intent !== testCase.expectedIntent) {
      failures.push(`chat API lead check returned HTTP ${response.status} / intent ${isRecord(body) ? String(body.intent) : "invalid response"}`);
      return failures;
    }

    const databaseResponse = await fetch(rowUrl, { headers });
    const rows: unknown = await databaseResponse.json();
    if (!databaseResponse.ok) {
      failures.push(`Supabase lead verification failed (HTTP ${databaseResponse.status})`);
    } else if (!Array.isArray(rows) || !rows.some((row) => isRecord(row)
      && row.session_id === sessionId
      && row.intent === testCase.expectedIntent
      && row.status === "new")) {
      failures.push("chat API response did not create the expected new Supabase lead row");
    }
  } catch (error) {
    failures.push(`API/Supabase lead check failed (${error instanceof Error ? error.name : "UnknownError"})`);
  } finally {
    try {
      const cleanup = new URL("/rest/v1/leads", supabaseUrl);
      cleanup.searchParams.set("session_id", `eq.${sessionId}`);
      const response = await fetch(cleanup, { method: "DELETE", headers });
      if (!response.ok) {
        failures.push(`could not clean up this evaluation's lead row (HTTP ${response.status})`);
      }
    } catch (error) {
      failures.push(`could not clean up this evaluation's lead row (${error instanceof Error ? error.name : "UnknownError"})`);
    }
  }
  return failures;
}

async function main() {
  const appId = process.env.DNOTIFIER_APP_ID;
  const secret = process.env.DNOTIFIER_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  if (!appId || !secret) {
    console.error("Live chat evaluation requires DNOTIFIER_APP_ID and DNOTIFIER_SECRET.");
    process.exitCode = 1;
    return;
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
  const documentResponse: unknown = await notifier.listDocuments({
    senderId: SENDER_ID,
    limit: 100,
    offset: 0,
    type: "text",
  });
  const idByUuid = new Map<string, string>();
  for (const row of responseRows(documentResponse)) {
    if (typeof row.id === "string" && typeof row.record_id === "string") {
      idByUuid.set(row.id, row.record_id);
    }
  }

  console.log(JSON.stringify({
    evaluation: "live DNotifier workflow and AI; source IDs mapped using live DNotifier document list",
    cases: chatEvalCases.length,
    businessSenderConfigured: true,
    sourceFilter: SOURCE,
    apiBaseConfigured: Boolean(BASE_URL),
    supabaseConfigured: Boolean(supabaseUrl && supabaseKey),
  }));

  let passed = 0;
  let persistenceFailures = 0;
  const results = new Map<string, { testCase: ChatEvalCase; result: ChatResult | null; failures: string[] }>();
  for (const testCase of chatEvalCases) {
    const sessionId = newSessionId(testCase.id);
    try {
      const run = await notifier.runWorkflow({
        workflow: supportWorkflow,
        input: { sessionId, message: testCase.message, evaluationTrace: true },
        senderId: SENDER_ID,
      });
      const result = parseWorkflowResult(run.result);
      const failures = validateCase(testCase, result, idByUuid);
      results.set(testCase.id, { testCase, result, failures });
      if (failures.length === 0) {
        passed++;
        console.log(JSON.stringify({
          id: testCase.id,
          status: "PASS",
          intent: result?.intent,
          classifiedIntent: result?.evaluationTrace?.classifiedIntent,
          behavior: testCase.behavior,
          sourceIds: stableSourceIds(result, idByUuid),
          searchOutcome: result?.evaluationTrace?.searchOutcome,
        }));
      } else {
        console.log(JSON.stringify({
          id: testCase.id,
          status: "FAIL",
          input: testCase.message,
          expectedIntent: testCase.expectedIntent,
          expectedBehavior: testCase.behavior,
          retrievedSourceIds: stableSourceIds(result, idByUuid),
          finalAnswer: result?.reply,
          failureCategories: failures,
        }));
      }
    } catch (error) {
      const failure = error instanceof Error ? error.name : "UnknownError";
      const failures = [`live workflow execution failed: ${failure}`];
      results.set(testCase.id, { testCase, result: null, failures });
      console.log(JSON.stringify({
        id: testCase.id,
        status: "FAIL",
        input: testCase.message,
        expectedIntent: testCase.expectedIntent,
        expectedBehavior: testCase.behavior,
        retrievedSourceIds: [],
        finalAnswer: null,
        failureCategories: failures,
      }));
    }
  }
  const workflowPassCount = passed;

  const persistenceCases = [
    chatEvalCases.find((item) => item.behavior === "lead"),
    chatEvalCases.find((item) => item.behavior === "human"),
  ].filter((item): item is ChatEvalCase => item !== undefined);
  if (supabaseUrl && supabaseKey) {
    for (const testCase of persistenceCases) {
      const failures = await verifyApiLeadPersistence(testCase, supabaseUrl, supabaseKey);
      if (failures.length > 0) persistenceFailures++;
      console.log(JSON.stringify({
        id: `${testCase.id}-api-persistence`,
        status: failures.length === 0 ? "PASS" : "FAIL",
        detail: failures.length === 0 ? "POST /api/chat persisted a new lead; scoped test row cleanup attempted" : failures,
      }));
    }
  } else {
    console.log("Supabase record persistence was not tested: required environment variables are absent.");
  }

  const workflowPassed = [...results.values()].filter((item) => item.failures.length === 0).length;
  const failed = chatEvalCases.length - workflowPassed;
  console.log(JSON.stringify({
    summary: {
      testType: "live end-to-end DNotifier workflow plus selected chat API/Supabase persistence checks",
      caseCount: chatEvalCases.length,
      workflowPassCount,
      workflowFailureCount: failed,
      apiPersistenceCases: supabaseUrl && supabaseKey ? persistenceCases.length : 0,
      apiPersistenceFailureCount: persistenceFailures,
      note: "Answer term and forbidden-claim checks are deterministic heuristics; the workflow uses live DNotifier routing, retrieval, and configured AI. Business fixtures remain fictional.",
    },
  }));
  if (failed > 0 || persistenceFailures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("End-to-end chat evaluation failed:", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
