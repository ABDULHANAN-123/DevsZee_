"use client";
import { MOCK_MODE, STATUS_URL, ownApi } from "./config";
import { mockChat, mockLeads, mockStatus } from "./mock";
import {
  isDetails,
  isIntent,
  isLead,
  type ChatResponse,
  type Lead,
  type LeadStatus,
} from "./types";

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(ownApi(path), {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    if (!response.ok) {
      // Don't display raw server errors; they could contain internal details.
      if (response.status === 429)
        throw new Error(
          "Too many requests. Please wait a moment before retrying.",
        );
      if (response.status === 401 || response.status === 403)
        throw new Error("Please sign in with an authorized account.");
      throw new Error(`Request failed (${response.status}). Please try again.`);
    }
    if (response.status === 204) return null;
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("The request timed out. Please try again.");
    if (error instanceof TypeError)
      throw new Error("Could not reach the server. Check your connection.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export async function sendChat(
  sessionId: string,
  message: string,
): Promise<ChatResponse> {
  if (MOCK_MODE) return mockChat(sessionId, message);
  const result = await request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ sessionId, message }),
  });
  if (!result || typeof result !== "object")
    throw new Error("The chat server returned an invalid response.");
  const r = result as Record<string, unknown>;
  if (
    typeof r.reply !== "string" ||
    !isIntent(r.intent) ||
    (r.lead !== undefined && !isDetails(r.lead))
  )
    throw new Error("The chat response does not match the shared contract.");
  return r as unknown as ChatResponse;
}
export async function getLeads(): Promise<Lead[]> {
  if (MOCK_MODE) return mockLeads();
  const result = await request("/api/leads");
  if (!Array.isArray(result) || !result.every(isLead))
    throw new Error(
      "The leads response must be an array matching the shared contract.",
    );
  return result.sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
}
export const canUpdateStatus = MOCK_MODE || Boolean(STATUS_URL);
export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<void> {
  if (MOCK_MODE) return mockStatus(id, status);
  // Optional proposed extension; disabled unless your backend teammate implements it.
  if (!STATUS_URL.includes("{id}"))
    throw new Error("Status updates need a backend URL containing {id}.");
  await request(STATUS_URL.replace("{id}", encodeURIComponent(id)), {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
