export interface FaqAnswer {
  answer: string;
  handoff: boolean;
}

const safeFallback: FaqAnswer = {
  answer: "I couldn't verify the answer. I'll refer this question to a human representative.",
  handoff: true,
};

function contentText(response: unknown): string {
  if (typeof response !== "object" || response === null) return "";
  const value = response as { data?: unknown; content?: unknown };
  const data = value.data;
  if (typeof data === "object" && data !== null && "content" in data) {
    const content = data.content;
    if (typeof content === "string") return content;
  }
  return typeof value.content === "string" ? value.content : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFaqAnswer(response: unknown, evidenceCount: number): FaqAnswer {
  if (evidenceCount <= 0) {
    return {
      answer: "I couldn't verify that from our available documents. I'll refer your question to a human representative.",
      handoff: true,
    };
  }

  try {
    const text = contentText(response)
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) return safeFallback;
    const value = parsed;
    if (typeof value.answer !== "string" || !value.answer.trim()
      || typeof value.handoff !== "boolean") {
      return safeFallback;
    }
    return { answer: value.answer.trim(), handoff: value.handoff };
  } catch {
    return safeFallback;
  }
}
