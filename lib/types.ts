export type Intent = "faq" | "hot_lead" | "needs_human";
export type LeadStatus = "new" | "contacted" | "closed";
export interface LeadDetails {
  name: string | null;
  contact: string | null;
  need: string | null;
  urgency: string | null;
}
export interface Lead extends LeadDetails {
  id: string;
  created_at: string;
  session_id: string;
  intent: Intent;
  status: LeadStatus;
  raw_message: string;
}
export interface ChatResponse {
  reply: string;
  intent: Intent;
  lead?: LeadDetails;
}
export interface AlertEvent {
  type: "alert";
  intent: Intent;
  message: string;
  lead?: LeadDetails;
  createdAt: string;
}
// Local feed IDs are not part of the team's wire contract.
export interface FeedAlert extends AlertEvent {
  feedId: string;
}
export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  intent?: Intent;
}
export const isIntent = (value: unknown): value is Intent =>
  ["faq", "hot_lead", "needs_human"].includes(String(value));
export const isStatus = (value: unknown): value is LeadStatus =>
  ["new", "contacted", "closed"].includes(String(value));
export function isDetails(value: unknown): value is LeadDetails {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return ["name", "contact", "need", "urgency"].every(
    (k) => v[k] === null || typeof v[k] === "string",
  );
}
export function isLead(value: unknown): value is Lead {
  if (!isDetails(value)) return false;
  const v = value as unknown as Record<string, unknown>;
  return (
    ["id", "created_at", "session_id", "raw_message"].every(
      (k) => typeof v[k] === "string",
    ) &&
    isIntent(v.intent) &&
    isStatus(v.status) &&
    Number.isFinite(Date.parse(String(v.created_at)))
  );
}
export function isAlert(value: unknown): value is AlertEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === "alert" &&
    isIntent(v.intent) &&
    typeof v.message === "string" &&
    typeof v.createdAt === "string" &&
    Number.isFinite(Date.parse(v.createdAt)) &&
    (v.lead === undefined || isDetails(v.lead))
  );
}
