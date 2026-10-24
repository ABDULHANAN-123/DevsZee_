"use client";
// Development adapter only. Real AI and delivery belong to the backend.
import { brand } from "./brand";
import {
  isAlert,
  isLead,
  type AlertEvent,
  type ChatResponse,
  type Lead,
  type LeadStatus,
} from "./types";
const KEY = "triage.mock.v1"; // Preserve the existing browser/session contract.
const CHANGE = "triage:mock-change";
interface Store {
  leads: Lead[];
  alerts: AlertEvent[];
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const uid = () => crypto.randomUUID();
export const alertKey = (alert: AlertEvent) =>
  JSON.stringify([
    alert.createdAt,
    alert.intent,
    alert.message,
    alert.lead?.name,
    alert.lead?.contact,
    alert.lead?.need,
    alert.lead?.urgency,
  ]);
function read(): Store {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { leads: [], alerts: [] };
  let data: Store;
  try {
    data = JSON.parse(raw) as Store;
    if (
      !Array.isArray(data.leads) ||
      !data.leads.every(isLead) ||
      !Array.isArray(data.alerts) ||
      !data.alerts.every(isAlert)
    )
      throw new Error();
  } catch {
    throw new Error(
      "Saved requests could not be read. Please contact your administrator.",
    );
  }
  // Remove only the four records bundled in v1, retaining user-created leads.
  // Keep the original browser data as a recovery copy before migration.
  const seededIds = new Set([
    "demo-session-1",
    "demo-session-2",
    "demo-session-3",
    "demo-session-4",
  ]);
  const seeded = data.leads.filter((lead) => seededIds.has(lead.session_id));
  if (seeded.length) {
    if (!localStorage.getItem("triage.backup.before-nexa"))
      localStorage.setItem("triage.backup.before-nexa", raw);
    data = {
      leads: data.leads.filter((lead) => !seededIds.has(lead.session_id)),
      alerts: data.alerts.filter(
        (alert) =>
          !seeded.some(
            (lead) =>
              lead.created_at === alert.createdAt &&
              lead.raw_message === alert.message,
          ),
      ),
    };
    write(data);
  }
  return data;
}
function write(data: Store) {
  localStorage.setItem(KEY, JSON.stringify(data));
  window.dispatchEvent(new Event(CHANGE));
}
export function listenToMock(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener();
  };
  window.addEventListener(CHANGE, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(CHANGE, listener);
    window.removeEventListener("storage", storage);
  };
}
export async function mockLeads(): Promise<Lead[]> {
  await pause(350);
  return read().leads.sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
}
export const mockAlerts = () => read().alerts;
export async function mockStatus(
  id: string,
  status: LeadStatus,
): Promise<void> {
  await pause(250);
  const data = read();
  const lead = data.leads.find((lead) => lead.id === id);
  if (!lead)
    throw new Error("This request no longer exists. Refresh the dashboard.");
  lead.status = status;
  write(data);
}
export async function mockChat(
  sessionId: string,
  message: string,
): Promise<ChatResponse> {
  await pause(750);
  const lower = message.toLowerCase();
  if (/^(hi|hello|hey)[! .]*$/.test(lower))
    return { reply: brand.welcome, intent: "faq" };
  if (
    /how (can|do) you help|how does this (work|chat work)|what can you do/.test(
      lower,
    )
  ) {
    return {
      reply:
        "You can ask a question, share what you’re looking for, or request a conversation with our team. Include a phone number or email if you’d like someone to follow up.",
      intent: "faq",
    };
  }
  const human =
    /\b(human|person|someone|owner|refund|complaint|custom)\b|speak to|talk to/.test(
      lower,
    );
  const hot =
    /\b(enrol\w*|sign.?up|book\w*|interested|join|register|trial|buy|purchase)\b/.test(
      lower,
    );
  // No business knowledge has been supplied: never fabricate prices/services.
  const intent =
    !human && hot ? ("hot_lead" as const) : ("needs_human" as const);
  const contact =
    message
      .match(/(?:\+?\d[\d\s()-]{7,}\d)|(?:[\w.+-]+@[\w.-]+\.[a-z]{2,})/i)?.[0]
      ?.trim() ?? null;
  const name =
    message.match(
      /(?:[Mm]y name is|[Ii] am|[Ii]['’]m)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    )?.[1] ?? null;
  const lead = {
    name,
    contact,
    need: message,
    urgency: /urgent|today|asap|immediately/.test(lower) ? "high" : "normal",
  };
  const createdAt = new Date().toISOString();
  const data = read();
  data.leads.unshift({
    ...lead,
    id: uid(),
    session_id: sessionId,
    created_at: createdAt,
    intent,
    status: "new",
    raw_message: message,
  });
  data.alerts.unshift({ type: "alert", intent, message, lead, createdAt });
  write(data);
  return {
    reply:
      intent === "hot_lead"
        ? `Thanks for your interest. Your request has been recorded for follow-up.${contact ? "" : " Please share a phone number or email so our team can contact you."}`
        : `I’ll leave this question for our team so you get the right information. Your request has been recorded.${contact ? "" : " Please share a phone number or email if you’d like a follow-up."}`,
    intent,
    lead,
  };
}
