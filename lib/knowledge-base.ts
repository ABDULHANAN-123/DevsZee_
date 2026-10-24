export const SEARCH_LIMIT = 5;
export const PRIMARY_SEARCH_MIN_SIMILARITY = 0.3;
export const EMPTY_RESULT_FALLBACK_MIN_SIMILARITY = 0.25;

export interface KnowledgeHit {
  documentId: string | null;
  chunkId: string | null;
  source: string | null;
  content: string;
  similarity: number | null;
}

export type SearchOutcome =
  | "request-error"
  | "malformed-response"
  | "zero-hits"
  | "hits-without-content"
  | "hits-with-content";

export interface NormalizedSearch {
  outcome: SearchOutcome;
  returnedHits: number | null;
  hits: KnowledgeHit[];
  errorName?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function searchRows(response: unknown): unknown[] | null {
  if (Array.isArray(response)) return response;
  if (!isRecord(response) || !isRecord(response.data)) return null;
  return Array.isArray(response.data.rows) ? response.data.rows : null;
}

export function normalizeSearchResponse(response: unknown): NormalizedSearch {
  const rows = searchRows(response);
  if (!rows) {
    return { outcome: "malformed-response", returnedHits: null, hits: [] };
  }
  if (rows.length === 0) {
    return { outcome: "zero-hits", returnedHits: 0, hits: [] };
  }

  const hits: KnowledgeHit[] = [];
  const seenChunks = new Set<string>();
  for (const row of rows) {
    if (!isRecord(row) || typeof row.content !== "string") continue;
    const content = row.content.trim();
    if (!content) continue;

    const documentId = typeof row.document_id === "string"
      ? row.document_id
      : typeof row.record_id === "string"
        ? row.record_id
        : null;
    const dedupeKey = `${documentId ?? ""}\u0000${content}`;
    if (seenChunks.has(dedupeKey)) continue;
    seenChunks.add(dedupeKey);

    const metadata = isRecord(row.metadata) ? row.metadata : {};
    hits.push({
      documentId,
      chunkId: typeof row.id === "string" ? row.id : null,
      source: typeof metadata.source === "string"
        ? metadata.source
        : typeof row.source === "string"
          ? row.source
          : null,
      content,
      similarity: typeof row.similarity === "number" && Number.isFinite(row.similarity)
        ? row.similarity
        : null,
    });
  }

  return {
    outcome: hits.length > 0 ? "hits-with-content" : "hits-without-content",
    returnedHits: rows.length,
    hits,
  };
}

export async function requestSearch(
  search: () => Promise<unknown>,
): Promise<NormalizedSearch> {
  try {
    return normalizeSearchResponse(await search());
  } catch (error) {
    return {
      outcome: "request-error",
      returnedHits: null,
      hits: [],
      errorName: error instanceof Error ? error.name : "UnknownError",
    };
  }
}
