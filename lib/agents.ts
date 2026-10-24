import "server-only";
import { DNotifier } from "@dnotifier-realtime/dnotifier";
import { parseFaqAnswer } from "./faq-answer";

function responseText(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const value = response as {
    data?: { content?: unknown };
    content?: unknown;
  };
  const content = value.data?.content ?? value.content;
  return typeof content === "string" ? content : "";
}

function parseJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI returned invalid JSON.");
  }
  return parsed as Record<string, unknown>;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function sendAI(
  ctx: { sendAI: (options: object) => Promise<unknown> },
  options: object,
  agentName: string,
): Promise<unknown> {
  try {
    return await ctx.sendAI(options);
  } catch (error) {
    console.error(`[${agentName}] DNotifier AI request failed`, {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}

export const routerAgent = DNotifier.defineAgent({
  name: "support-router",
  provider: "open_ai",
  model: "gpt-4o",
  async run(ctx) {
    const input = ctx.input;
    const message = typeof input === "string"
      ? input
      : asText(input?.message ?? input?.text);

    if (!message.trim()) {
      throw new DNotifier.WorkflowError("support-router: empty input", {
        agentName: "support-router",
      });
    }

    try {
      const response = await sendAI(ctx, {
        message: {
          useKnowledgeBase: false,
          messages: [
            {
              role: "system",
              content: `Classify the message. Return exactly one JSON object with
one of these intents: {"intent":"business_faq"}, {"intent":"general"},
{"intent":"hot_lead"}, or {"intent":"needs_human"}.

business_faq = any question about Noor Academy, Quran classes, courses, fees,
discounts, admission, schedules, teachers, certificates, refunds, or business
policies. Policy questions must go to business_faq so retrieved documents can
be checked; do not decide or answer a policy question yourself.
general = unrelated general-knowledge questions that do not concern the academy.
hot_lead = clear intent to enroll, book, buy, or request a consultation,
including a stated plan to enroll.
needs_human = explicit request for a person, complaint/dispute, or sensitive
request requiring a human.
Understand English and Roman Urdu. Do not answer the question or invent facts.
If uncertain whether a question concerns academy information, choose
business_faq; otherwise choose needs_human.`,
            },
            { role: "user", content: message },
          ],
        },
        saveHistory: false,
        label: "Support intent classification",
      }, "support-router");
      const parsed = parseJson(responseText(response));
      const allowed = ["business_faq", "general", "hot_lead", "needs_human"];
      const intent = allowed.includes(asText(parsed.intent))
        ? asText(parsed.intent)
        : "needs_human";
      return { intent };
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error("[support-router] invalid DNotifier AI response", {
          errorName: error.name,
        });
      }
      return { intent: "needs_human" };
    }
  },
});

export const generalAgent = DNotifier.defineAgent({
  name: "support-general",
  provider: "open_ai",
  model: "gpt-4o",
  async run(ctx) {
    const input = ctx.input;
    const question = typeof input === "string"
      ? input
      : asText(input?.message);
    if (!question.trim()) {
      return { answer: "" };
    }

    const response = await sendAI(ctx, {
      message: {
        useKnowledgeBase: false,
        messages: [
          {
            role: "system",
            content: `Answer the user's unrelated general-knowledge question
clearly and accurately. Do not answer questions about Noor Academy, its courses,
fees, admissions, schedules, or policies; those must be answered only from
retrieved business documents. If uncertain, say so rather than inventing facts.
Respond in the same language as the question. If it is in English, answer in
English.`,
          },
          { role: "user", content: question },
        ],
      },
      saveHistory: false,
      label: "General knowledge answer",
    }, "support-general");
    const answer = responseText(response).trim();
    if (!answer) {
      console.warn("[support-general] DNotifier AI returned no answer");
    }
    return { answer };
  },
});

export const faqAgent = DNotifier.defineAgent({
  name: "support-faq",
  provider: "open_ai",
  model: "gpt-4o",
  async run(ctx) {
    const input = ctx.input;
    const question = typeof input === "string"
      ? input
      : asText(input?.message);
    const hits = input && typeof input === "object" ? input.hits : undefined;

    if (!Array.isArray(hits) || hits.length === 0) {
      return {
        answer: "I couldn't verify that from our available documents. I'll refer your question to a human representative.",
        handoff: true,
      };
    }

    const response = await sendAI(ctx, {
      message: {
        useKnowledgeBase: false,
        messages: [
          {
            role: "system",
            content: `You are the FAQ assistant for Noor Online Quran Academy.
            Use ONLY the supplied search results as evidence. Answer every supported part
            of a multi-part question. Hand off only when a detail the user actually asked
            for is missing, uncertain, or conflicting. Do not enumerate unrelated missing
            policies or request human follow-up after fully answering a question. For a
            question asking for actual/current business facts, demo-only information is
            not sufficient: explain that it is unverified and request human confirmation.
            If sources conflict, do not choose one: explain the conflict and request human
            confirmation. Never invent prices, discounts, refunds, schedules, teacher
            availability, certificates, or enrollment promises.
            Documents may be explicitly marked as fictional demo fixtures. You may
            summarize demo course information only while clearly saying it is demo
            information and not confirmed academy information. Never present demo fees,
            dates, availability, or policies as real or confirmed. When the user asks for
            fees and the only available amounts are demo examples, list the relevant
            amounts only with an explicit fictional/demo disclaimer; set handoff=false
            unless the user asks for verified/current amounts or another missing policy.
            For unsupported payment, refund, discount, contact, or admission policy
            questions, say the policy is not documented and set handoff=true. Answer in
            the user's language where practical. Return JSON only:
            {"answer":"answer text","handoff":false}
            or {"answer":"supported facts plus unresolved details and human handoff","handoff":true}.`,
          },
          {
            role: "user",
            content: JSON.stringify({ question, knowledgeBaseResults: hits }),
          },
        ],
      },
      saveHistory: false,
      label: "Grounded FAQ answer",
    }, "support-faq");

    return parseFaqAnswer(response, hits.length);
  },
});

export const leadAgent = DNotifier.defineAgent({
  name: "support-lead-extractor",
  provider: "open_ai",
  model: "gpt-4o",
  async run(ctx) {
    const input = ctx.input;
    const message = typeof input === "string"
      ? input
      : asText(input?.message);

    const response = await sendAI(ctx, {
      message: {
        useKnowledgeBase: false,
        messages: [
          {
            role: "system",
            content: `Extract a prospective customer's details from English or
Roman Urdu. Return STRICT JSON only with exactly these string fields:
{"name":"...","contact":"...","need":"...","urgency":"..."}.
Use "Not provided" for missing name/contact, "Not specified" for missing need.
urgency must be high, medium, low, or unknown. Do not invent personal details.
Use high only for explicit urgent language/deadline, medium for a stated near-term
request, low for no time pressure, unknown if unclear. No Markdown.`,
          },
          { role: "user", content: message },
        ],
      },
      saveHistory: false,
      label: "Lead extraction",
    }, "support-lead-extractor");

    try {
      const parsed = parseJson(responseText(response));
      const urgency = ["high", "medium", "low", "unknown"].includes(asText(parsed.urgency))
        ? asText(parsed.urgency)
        : "unknown";
      return {
        name: asText(parsed.name) || "Not provided",
        contact: asText(parsed.contact) || "Not provided",
        need: asText(parsed.need) || "Not specified",
        urgency,
      };
    } catch {
      return {
        name: "Not provided",
        contact: "Not provided",
        need: "Not specified",
        urgency: "unknown",
      };
    }
  },
});
