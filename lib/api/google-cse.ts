import { z } from "zod";
import { buildSearchQuery } from "@/lib/query";

const SERPAPI_API_URL = "https://serpapi.com/search.json";
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 10;

export type SerpApiAccessContext =
  | "build-query"
  | "target-sweep"
  | "batch-discovery"
  | "image-analysis"
  | "other";

const ALLOWED_SERPAPI_CONTEXTS = new Set<SerpApiAccessContext>([
  "build-query",
  "target-sweep",
]);

export type SearchOperatorKey =
  | "site"
  | "inurl"
  | "intitle"
  | "intext"
  | "filetype"
  | "before"
  | "after";

export type StructuredSearchOperators = Partial<
  Record<SearchOperatorKey, string | string[] | undefined>
>;

export type GoogleCseRequest = {
  query?: string;
  operators?: StructuredSearchOperators;
  start?: number;
  num?: number;
  exactTerms?: string[];
  excludeTerms?: string[];
  orTerms?: string[];
};

export const googleCseSearchResultSchema = z.object({
  title: z.string().default(""),
  link: z.string().url(),
  snippet: z.string().default(""),
  displayLink: z.string().optional().default(""),
  formattedUrl: z.string().optional().default(""),
  mime: z.string().optional(),
  fileFormat: z.string().optional(),
});

export type GoogleCseSearchResult = z.infer<typeof googleCseSearchResultSchema>;

export const googleCseResponseSchema = z.object({
  queries: z
    .object({
      request: z
        .array(
          z.object({
            title: z.string().optional(),
            totalResults: z.string().optional().default("0"),
            searchTerms: z.string().optional().default(""),
            count: z.number().optional().default(DEFAULT_PAGE_SIZE),
            startIndex: z.number().optional().default(1),
          }),
        )
        .optional()
        .default([]),
      nextPage: z
        .array(
          z.object({
            startIndex: z.number().optional().default(1),
            count: z.number().optional().default(DEFAULT_PAGE_SIZE),
          }),
        )
        .optional()
        .default([]),
    })
    .optional()
    .default({ request: [], nextPage: [] }),
  searchInformation: z
    .object({
      totalResults: z.string().optional().default("0"),
      searchTime: z.number().optional().default(0),
      formattedSearchTime: z.string().optional().default("0"),
    })
    .optional()
    .default({ totalResults: "0", searchTime: 0, formattedSearchTime: "0" }),
  items: z.array(googleCseSearchResultSchema).optional().default([]),
});

export type GoogleCseResponse = z.infer<typeof googleCseResponseSchema>;

export type GoogleCseSearchResponse = {
  items: GoogleCseSearchResult[];
  totalResults: number;
  searchTerms: string;
  startIndex: number;
  count: number;
  hasNextPage: boolean;
  nextPageStartIndex: number | null;
  searchTime: number;
  raw: GoogleCseResponse;
};

export class GoogleCseConfigError extends Error {
  constructor(message = "Google Custom Search API credentials are not configured.") {
    super(message);
    this.name = "GoogleCseConfigError";
  }
}

export class GoogleCseRequestError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "GoogleCseRequestError";
    this.status = status;
    this.details = details;
  }
}





function clampPageSize(value?: number) {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(Math.floor(value), 1), MAX_PAGE_SIZE);
}

function normalizeStartIndex(value?: number) {
  if (!value || Number.isNaN(value)) {
    return 1;
  }

  return Math.max(Math.floor(value), 1);
}

export async function searchGoogleCse(
  request: GoogleCseRequest,
  init?: RequestInit,
  context: SerpApiAccessContext = "other",
): Promise<GoogleCseSearchResponse> {
  if (!ALLOWED_SERPAPI_CONTEXTS.has(context)) {
    throw new GoogleCseRequestError(
      `SerpAPI access is restricted for context: ${context}.`,
      403,
    );
  }

  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) {
    throw new GoogleCseConfigError("SerpAPI key is not configured for search.");
  }

  const q = buildSearchQuery({
    operators: request.operators,
    freeText: request.query,
  });

  if (!q) {
    throw new GoogleCseRequestError("A query is required to search.", 400);
  }

  const start = normalizeStartIndex(request.start);
  const num = Math.min(clampPageSize(request.num), 10); // SerpAPI num limit is usually bounded per plan, but let's clamp.

  const params = new URLSearchParams({
    engine: "google",
    q,
    start: String(start - 1), // SerpAPI uses zero-based offset usually, but we can pass `start` as is commonly done in CSE. Let's just use what they document (start is offset).
    num: String(num),
  });

  try {
    const response = await fetch(`${SERPAPI_API_URL}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Authorization": `Bearer ${apiKey}`,
        ...init?.headers,
      },
      ...init,
    });

    if (!response.ok) {
      let details: unknown;
      try {
        details = await response.json();
      } catch {
        details = await response.text();
      }

      console.error(
        `[SerpAPI] Request failed (${response.status}):`,
        JSON.stringify(details, null, 2),
      );

      throw new GoogleCseRequestError(
        `SerpAPI request failed with status ${response.status}.`,
        response.status,
        details,
      );
    }

    const raw = await response.json();

    const items: GoogleCseSearchResult[] = (raw.organic_results || []).map((res: any) => ({
      title: res.title || "",
      link: res.link || "",
      snippet: res.snippet || "",
      displayLink: res.displayed_link || "",
      formattedUrl: res.link || "",
    }));

    return {
      items,
      totalResults: raw.search_information?.total_results || items.length,
      searchTerms: q,
      startIndex: start,
      count: items.length,
      hasNextPage: !!raw.serpapi_pagination?.next,
      nextPageStartIndex: raw.serpapi_pagination?.next ? start + num : null,
      searchTime: raw.search_information?.time_taken_displayed || 0,
      raw: raw as any,
    };
  } catch (error: any) {
    console.error("[SerpAPI Search] Request failed:", error);
    throw new GoogleCseRequestError(
      error.message || "SerpAPI Search failed",
      500,
      error
    );
  }
}

export async function searchGoogleCseBatch(
  requests: GoogleCseRequest[],
  init?: RequestInit,
  context: SerpApiAccessContext = "other",
) {
  return Promise.all(
    requests.map(async (request) => {
      const query = buildSearchQuery({
        operators: request.operators,
        freeText: request.query,
      });

      try {
        const response = await searchGoogleCse(request, init, context);

        return {
          query,
          ok: true as const,
          response,
        };
      } catch (error) {
        return {
          query,
          ok: false as const,
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  ...(error instanceof GoogleCseRequestError
                    ? { status: error.status, details: error.details }
                    : {}),
                }
              : {
                  name: "UnknownError",
                  message: "Unknown error while querying SerpAPI Search.",
                },
        };
      }
    }),
  );
}
