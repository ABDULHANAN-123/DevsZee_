import { NextResponse } from "next/server";
import { connectDNotifier, getNotifier } from "@/lib/dnotifier";
import { supportWorkflow } from "@/lib/workflow";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const intents = ["faq", "hot_lead", "needs_human"] as const;
type Intent = (typeof intents)[number];

function isIntent(value: unknown): value is Intent {
  return typeof value === "string" && intents.includes(value as Intent);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    const sessionId = typeof record.sessionId === "string" ? record.sessionId.trim() : "";
    const message = typeof record.message === "string" ? record.message.trim() : "";

    if (!sessionId || !message) {
      return NextResponse.json({ error: "sessionId and message are required." }, { status: 400 });
    }
    if (sessionId.length > 200 || message.length > 4000) {
      return NextResponse.json({ error: "Input exceeds the allowed length." }, { status: 413 });
    }

    await connectDNotifier();
    const run = await getNotifier().runWorkflow({
      workflow: supportWorkflow,
      input: { sessionId, message },
      senderId: "support-backend",
    });

    const result = run.result && typeof run.result === "object"
      ? run.result as Record<string, unknown>
      : {};
    const intent: Intent = isIntent(result.intent) ? result.intent : "needs_human";
    const reply = typeof result.reply === "string"
      ? result.reply
      : "I'll refer your message to our support team.";

    let lead: { name: string | null; contact: string | null; need: string | null; urgency: string | null } | undefined;

    if (intent === "hot_lead" || intent === "needs_human") {
      const rawLead = result.lead && typeof result.lead === "object"
        ? result.lead as Record<string, unknown>
        : {};
      lead = {
        name: nullableString(rawLead.name),
        contact: nullableString(rawLead.contact),
        need: nullableString(rawLead.need),
        urgency: nullableString(rawLead.urgency),
      };

      const { error } = await getSupabase().from("leads").insert({
        session_id: sessionId,
        name: lead.name,
        contact: lead.contact,
        need: lead.need,
        urgency: lead.urgency,
        intent,
        status: "new",
        raw_message: message,
      });

      if (error) {
        console.error("Lead persistence failed:", error.message);
        return NextResponse.json(
          { error: "Your request needs follow-up, but we couldn't save it. Please try again." },
          { status: 503 },
        );
      }
    }

    return NextResponse.json({
      reply,
      intent,
      ...(lead ? { lead } : {}),
    });
  } catch (error) {
    console.error("Chat workflow failed:", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "The support service is temporarily unavailable. Please try again." },
      { status: 500 },
    );
  }
}
