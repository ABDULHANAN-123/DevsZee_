import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DNotifier } from "@dnotifier-realtime/dnotifier";
import { businessDocuments } from "../lib/business-documents";

const appId = process.env.DNOTIFIER_APP_ID;
const secret = process.env.DNOTIFIER_SECRET;
if (!appId || !secret) {
  throw new Error("Set DNOTIFIER_APP_ID and DNOTIFIER_SECRET in .env.local.");
}

const USER_ID = "support-backend";
const SOURCE = "noor-academy";
const PAGE_SIZE = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function responseRows(response: unknown): unknown[] {
  if (!isRecord(response)) {
    throw new Error("DNotifier returned an invalid document-list response.");
  }
  const data = response.data;
  if (!isRecord(data) || !Array.isArray(data.rows)) {
    throw new Error("DNotifier returned an invalid document-list response.");
  }
  return data.rows;
}

async function listExistingRecordIds(notifier: InstanceType<typeof DNotifier>): Promise<Set<string>> {
  const recordIds = new Set<string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response: unknown = await notifier.listDocuments({
      senderId: USER_ID,
      limit: PAGE_SIZE,
      offset,
      type: "text",
    });
    const rows = responseRows(response);
    for (const row of rows) {
      if (!isRecord(row) || typeof row.record_id !== "string") {
        throw new Error("DNotifier returned a malformed document row.");
      }
      recordIds.add(row.record_id);
    }
    if (rows.length < PAGE_SIZE) return recordIds;
  }
}

async function main() {
  const ids = new Set<string>();
  for (const doc of businessDocuments) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.id)) {
      throw new Error(`Invalid knowledge-base document ID: ${doc.id}`);
    }
    if (ids.has(doc.id)) {
      throw new Error(`Duplicate knowledge-base document ID: ${doc.id}`);
    }
    if (!doc.content.trim()) {
      throw new Error(`Knowledge-base document has empty content: ${doc.id}`);
    }
    ids.add(doc.id);
  }

  const notifier = new DNotifier({
    appId,
    secret,
    transport: "http",
    userId: USER_ID,
    logs: true,
    url: undefined,
    onConnected: () => {},
    onMessage: () => {},
    onDisconnected: () => {},
    WebSocketImpl: undefined,
  });
  await notifier.connect();

  const existingIds = await listExistingRecordIds(notifier);
  for (const doc of businessDocuments) {
    try {
      const document = {
        senderId: USER_ID,
        recordId: doc.id,
        content: doc.content,
        type: "text",
        metadata: {
          source: SOURCE,
          locale: "en",
          demo: true,
          status: doc.status,
          sourceType: doc.sourceType,
          topic: doc.topic,
          title: doc.title,
        },
      };
      if (existingIds.has(doc.id)) {
        await notifier.updateDocument(document);
        console.log("Updated:", doc.id);
      } else {
        await notifier.addDocument(document);
        console.log("Added:", doc.id);
      }
    } catch (error) {
      console.error(
        `Could not index ${doc.id}.`,
        { errorName: error instanceof Error ? error.name : "UnknownError" },
      );
      throw error;
    }
  }
  console.log("Knowledge-base import complete.");
}

main().catch((error) => {
  console.error("Knowledge-base setup failed:", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
