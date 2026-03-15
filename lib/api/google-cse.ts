import { z } from "zod";

const GOOGLE_CSE_API_URL = "https://www.googleapis.com/customsearch/v1";
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 10;

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

function getGoogleCseConfig() {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId) {
    throw new GoogleCseConfigError();
  }

  return { apiKey, cseId };
}

function normalizeOperatorValue(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function quoteIfNeeded(value: string) {
  if (/\s/.test(value) && !/^".*"$/.test(value)) {
    return `"${value}"`;
  }

  return value;
}

export function buildStructuredQuery({
  query,
  operators = {},
  exactTerms = [],
  excludeTerms = [],
  orTerms = [],
}: Pick<
  GoogleCseRequest,
  "query" | "operators" | "exactTerms" | "excludeTerms" | "orTerms"
>) {
  const fragments: string[] = [];

  const baseQuery = query?.trim();
  if (baseQuery) {
    fragments.push(baseQuery);
  }

  for (const site of normalizeOperatorValue(operators.site)) {
    fragments.push(`site:${site}`);
  }

  for (const inurl of normalizeOperatorValue(operators.inurl)) {
    fragments.push(`inurl:${quoteIfNeeded(inurl)}`);
  }

  for (const intitle of normalizeOperatorValue(operators.intitle)) {
    fragments.push(`intitle:${quoteIfNeeded(intitle)}`);
  }

  for (const intext of normalizeOperatorValue(operators.intext)) {
    fragments.push(`intext:${quoteIfNeeded(intext)}`);
  }

  for (const filetype of normalizeOperatorValue(operators.filetype)) {
    const normalized = filetype.replace(/^\./, "");
    if (normalized) {
      fragments.push(`filetype:${normalized}`);
    }
  }

  for (const before of normalizeOperatorValue(operators.before)) {
    fragments.push(`before:${before}`);
  }

  for (const after of normalizeOperatorValue(operators.after)) {
    fragments.push(`after:${after}`);
  }

  for (const term of exactTerms.map((item) => item.trim()).filter(Boolean)) {
    fragments.push(quoteIfNeeded(term));
  }

  for (const term of excludeTerms.map((item) => item.trim()).filter(Boolean)) {
    fragments.push(`-${quoteIfNeeded(term)}`);
  }

  const normalizedOrTerms = orTerms.map((item) => item.trim()).filter(Boolean);
  if (normalizedOrTerms.length > 0) {
    fragments.push(
      `(${normalizedOrTerms.map((term) => quoteIfNeeded(term)).join(" OR ")})`,
    );
  }

  return fragments.join(" ").trim();
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
): Promise<GoogleCseSearchResponse> {
  const { apiKey, cseId } = getGoogleCseConfig();
  const q = buildStructuredQuery(request);

  if (!q) {
    throw new GoogleCseRequestError("A query is required to search Google Custom Search.", 400);
  }

  const start = normalizeStartIndex(request.start);
  const num = clampPageSize(request.num);

  const params = new URLSearchParams({
    key: apiKey,
    cx: cseId,
    q,
    start: String(start),
    num: String(num),
  });

  const response = await fetch(`${GOOGLE_CSE_API_URL}?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
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

    throw new GoogleCseRequestError(
      `Google Custom Search request failed with status ${response.status}.`,
      response.status,
      details,
    );
  }

  const json = await response.json();
  const raw = googleCseResponseSchema.parse(json);

  const requestInfo = raw.queries.request[0];
  const nextPageInfo = raw.queries.nextPage[0];

  return {
    items: raw.items,
    totalResults: Number(raw.searchInformation.totalResults ?? "0") || 0,
    searchTerms: requestInfo?.searchTerms ?? q,
    startIndex: requestInfo?.startIndex ?? start,
    count: requestInfo?.count ?? num,
    hasNextPage: Boolean(nextPageInfo),
    nextPageStartIndex: nextPageInfo?.startIndex ?? null,
    searchTime: raw.searchInformation.searchTime ?? 0,
    raw,
  };
}

export async function searchGoogleCseBatch(
  requests: GoogleCseRequest[],
  init?: RequestInit,
) {
  return Promise.all(
    requests.map(async (request) => {
      const query = buildStructuredQuery(request);

      try {
        const response = await searchGoogleCse(request, init);

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
                  message: "Unknown error while querying Google Custom Search.",
                },
        };
      }
    }),
  );
}
