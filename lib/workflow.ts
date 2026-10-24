import "server-only";
import { DNotifier } from "@dnotifier-realtime/dnotifier";
import { faqAgent, generalAgent, leadAgent, routerAgent } from "./agents";
import {
  EMPTY_RESULT_FALLBACK_MIN_SIMILARITY,
  PRIMARY_SEARCH_MIN_SIMILARITY,
  SEARCH_LIMIT,
  requestSearch,
  type KnowledgeHit,
} from "./knowledge-base";

type Intent = "faq" | "business_faq" | "general" | "hot_lead" | "needs_human";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBusinessQuestion(message: string): boolean {
  return /\b(?:noor|academy|quran|tajweed|hifz|fee|fees|price|prices|discount|refund|payment|payments|admission|enroll(?:ment)?|teacher|timing|schedule|certificate|trial class|policy|policies)\b/i
    .test(message)
    || /\b(?:your|the|noor's|academy'?s)\s+(?:courses?|classes?)\b|\b(?:courses?|classes?)\s+(?:at|for)\s+(?:noor|the academy)\b/i
    .test(message)
    || /\b(?:contact|reach|call|email)\b.{0,35}\b(?:academy|support|representative|team)\b|\bsupport contact\b/i
      .test(message);
}

function isBusinessPolicyQuestion(message: string): boolean {
  return /\b(?:fee|fees|price|prices|discount|refund|payment|payments|admission|policy|policies|timing|schedule|availability|certificate)\b/i
    .test(message)
    || /\b(?:contact|reach|call|email)\b.{0,35}\b(?:academy|support|representative|team)\b|\bsupport contact\b/i
      .test(message);
}

function isHotLeadMessage(message: string): boolean {
  return /\b(?:want|would like|plan to|planning to|looking to|ready to)\b.{0,50}\b(?:enroll|join|register|sign up|book|consultation)\b/i
    .test(message);
}

function explicitlyRequestsHuman(message: string): boolean {
  return /\b(?:real person|human|live agent|representative|speak to (?:a )?person|talk to (?:a )?person|speak to (?:a )?human|talk to (?:a )?human)\b/i
    .test(message);
}

function searchHitDiagnostic(hit: KnowledgeHit) {
  const preview = hit.content
    .slice(0, 120)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted number]");

  return {
    documentId: hit.documentId,
    source: hit.source,
    contentLength: hit.content.length,
    preview: preview || null,
  };
}

function isRouterResult(value: unknown): value is { intent: Intent } {
  if (typeof value !== "object" || value === null || !("intent" in value)) {
    return false;
  }

  return value.intent === "faq"
    || value.intent === "business_faq"
    || value.intent === "general"
    || value.intent === "hot_lead"
    || value.intent === "needs_human";
}

export const supportWorkflow = new DNotifier.Workflow({
  name: "ai-support-lead-triage",
  description: "Route support messages to grounded FAQ, lead extraction, or human handoff.",
  observability: true,
  async entry(ctx) {
    const input = ctx.input;
    const message = typeof input === "string"
      ? input
      : String(input?.message ?? "");
    const includeEvaluationTrace = isRecord(input) && input.evaluationTrace === true;
    const evaluationTrace = {
      classifiedIntent: null as Intent | null,
      intent: null as Intent | null,
      searchOutcome: "not-run",
      threshold: null as number | null,
      sourceDocumentIds: [] as string[],
    };
    const finalize = (result: Record<string, unknown>) => {
      if (result.intent === "faq" || result.intent === "hot_lead" || result.intent === "needs_human") {
        evaluationTrace.intent = result.intent;
      }
      return includeEvaluationTrace
        ? { ...result, evaluationTrace: { ...evaluationTrace } }
        : result;
    };

    let routing: unknown;
    try {
      routing = await ctx.runAgent("support-router", {
        input: { message },
      });
    } catch (error) {
      console.error("[support-router] DNotifier agent failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      routing = { intent: "needs_human" };
    }

    const classifiedIntent: Intent = isRouterResult(routing) ? routing.intent : "needs_human";
    evaluationTrace.classifiedIntent = classifiedIntent;
    const intent: Intent =
        explicitlyRequestsHuman(message)
          ? "needs_human"
          : isHotLeadMessage(message)
            ? "hot_lead"
            : classifiedIntent === "general" && isBusinessQuestion(message)
              || classifiedIntent === "needs_human" && isBusinessPolicyQuestion(message)
              ? "business_faq"
              : classifiedIntent;
    evaluationTrace.intent = intent === "business_faq" ? "faq" : intent;
    console.info("[support-router] route", { classifiedIntent, intent });

    if (intent === "general") {
      try {
        const general = await ctx.runAgent("support-general", {
          input: { message },
        });
        if (typeof general?.answer !== "string" || !general.answer.trim()) {
          console.warn("[support-general] empty answer; handing off");
          return finalize({
            intent: "needs_human",
            reply: "I couldn't answer that reliably. I'll refer your question to a human representative.",
          });
        }
        return finalize({ intent: "faq", reply: general.answer });
      } catch (error) {
        console.error("[support-general] DNotifier agent failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        return finalize({
          intent: "needs_human",
          reply: "I couldn't answer that reliably. I'll refer your question to a human representative.",
        });
      }
    }

    if (intent === "business_faq" || intent === "faq") {
      let thresholdUsed = PRIMARY_SEARCH_MIN_SIMILARITY;
      let search = await requestSearch(() => ctx.search({
          query: message,
          limit: SEARCH_LIMIT,
          minSimilarity: PRIMARY_SEARCH_MIN_SIMILARITY,
          filterbySource: "noor-academy",
          label: "Noor Academy semantic search",
        }));
      if (search.outcome === "zero-hits") {
        thresholdUsed = EMPTY_RESULT_FALLBACK_MIN_SIMILARITY;
        search = await requestSearch(() => ctx.search({
          query: message,
          limit: SEARCH_LIMIT,
          minSimilarity: EMPTY_RESULT_FALLBACK_MIN_SIMILARITY,
          filterbySource: "noor-academy",
          label: "Noor Academy semantic search fallback",
        }));
        console.info("[faq-search] empty-result fallback", {
          threshold: thresholdUsed,
          outcome: search.outcome,
        });
      }
      evaluationTrace.searchOutcome = search.outcome;
      evaluationTrace.threshold = thresholdUsed;
      if (search.outcome === "request-error") {
        console.error("[faq-search] request failed", { errorName: search.errorName });
        return finalize({
          intent: "needs_human",
          reply: "I couldn't verify that from our available documents. I'll refer your question to a human representative.",
        });
      }

      const hits = search.hits.filter(
        (hit) => hit.source === null || hit.source === "noor-academy",
      );
      evaluationTrace.sourceDocumentIds = [...new Set(
        hits.flatMap((hit) => hit.documentId ? [hit.documentId] : []),
      )];

      console.info("[faq-search] result", {
        outcome: search.outcome,
        threshold: thresholdUsed,
        returnedHits: search.returnedHits,
        usableHits: hits.length,
        hitDetails: hits.map(searchHitDiagnostic),
      });

      let faq: { answer?: string; handoff?: boolean };
      try {
        faq = await ctx.runAgent("support-faq", {
          input: { message, hits },
        });
      } catch (error) {
        console.error("[faq-agent] request failed", {
          evidenceHits: hits.length,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        return finalize({
          intent: "needs_human",
          reply: "I couldn't verify that from our available documents. I'll refer your question to a human representative.",
        });
      }

      if (faq?.handoff) {
        console.info("[faq-agent] handoff", {
          evidenceHits: hits.length,
          reason: hits.length > 0 ? "handoff-with-evidence" : "no-usable-evidence",
        });
        return finalize({ intent: "needs_human", reply: faq.answer });
      }
      console.info("[faq-agent] answered", {
        evidenceHits: hits.length,
        hasAnswer: typeof faq?.answer === "string" && faq.answer.length > 0,
      });
      return finalize({ intent: "faq", reply: faq?.answer ?? "I couldn't verify that answer." });
    }

    if (intent === "hot_lead") {
      const lead = await ctx.runAgent("support-lead-extractor", {
        input: { message },
      });
      return finalize({
        intent: "hot_lead",
        reply: "Thanks for your interest. Our team will follow up to help with your request.",
        lead,
      });
    }

    const lead = await ctx.runAgent("support-lead-extractor", {
      input: { message },
    });
    return finalize({
      intent: "needs_human",
      reply: "I'll refer your message to our support team so they can help you accurately.",
      lead,
    });
  },
}).registerAgents({
  "support-router": routerAgent,
  "support-general": generalAgent,
  "support-faq": faqAgent,
  "support-lead-extractor": leadAgent,
});
