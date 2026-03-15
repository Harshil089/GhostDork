export type SearchOperatorKey =
  | "site"
  | "inurl"
  | "intitle"
  | "intext"
  | "filetype"
  | "before"
  | "after";

export type SearchOperatorValue = string | string[] | null | undefined;

export type SearchOperators = Partial<Record<SearchOperatorKey, SearchOperatorValue>>;

export type QueryTemplate = {
  id: string;
  label: string;
  description: string;
  category:
    | "exposed-config"
    | "directory-listing"
    | "documents"
    | "social-enum";
  operators: SearchOperators;
  freeText?: string;
};

export const DOCUMENT_FILE_TYPES = [
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "txt",
  "csv",
] as const;

export const CONFIG_FILE_TYPES = [
  "json",
  "yaml",
  "xml",
  "sql",
  "log",
  "env",
] as const;

export const ARCHIVE_FILE_TYPES = ["zip", "tar"] as const;

export const ALL_DISCOVERY_FILE_TYPES = [
  ...DOCUMENT_FILE_TYPES,
  ...CONFIG_FILE_TYPES,
  ...ARCHIVE_FILE_TYPES,
] as const;

export type DiscoveryFileType = (typeof ALL_DISCOVERY_FILE_TYPES)[number];

export const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    id: "config-env",
    label: "Exposed environment files",
    description: "Search for publicly indexed environment and config artifacts.",
    category: "exposed-config",
    operators: {
      filetype: ["env", "json", "yaml", "xml"],
      intext: ["API_KEY", "SECRET", "TOKEN"],
    },
  },
  {
    id: "open-indexes",
    label: "Open directory listings",
    description: "Look for web indexes and exposed browseable directories.",
    category: "directory-listing",
    operators: {
      intitle: ["index of", "directory listing"],
      inurl: ["parent directory", "uploads", "backup"],
    },
  },
  {
    id: "public-docs",
    label: "Public document repositories",
    description: "Locate documents commonly exposed through portals and shares.",
    category: "documents",
    operators: {
      filetype: ["pdf", "docx", "xlsx", "pptx"],
      inurl: ["documents", "files", "uploads", "share"],
    },
  },
  {
    id: "social-profiles",
    label: "Social profile enumeration",
    description: "Search for usernames across profile-style pages.",
    category: "social-enum",
    operators: {
      site: [
        "github.com",
        "twitter.com",
        "x.com",
        "linkedin.com",
        "instagram.com",
      ],
      inurl: ["user", "profile"],
    },
  },
];

const OPERATOR_ORDER: SearchOperatorKey[] = [
  "site",
  "inurl",
  "intitle",
  "intext",
  "filetype",
  "before",
  "after",
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeQuotedValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

function needsQuoting(value: string): boolean {
  return /\s/.test(value.trim());
}

function wrapValue(value: string): string {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return "";
  }

  return needsQuoting(normalized)
    ? `"${escapeQuotedValue(normalized)}"`
    : normalized;
}

function toArray(value: SearchOperatorValue): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeWhitespace(String(item))).filter(Boolean);
  }

  if (typeof value === "string") {
    const normalized = normalizeWhitespace(value);
    return normalized ? [normalized] : [];
  }

  return [];
}

export function buildOperatorFragment(
  operator: SearchOperatorKey,
  value: SearchOperatorValue,
): string[] {
  const values = toArray(value);

  if (values.length === 0) {
    return [];
  }

  return values.map((entry) => `${operator}:${wrapValue(entry)}`);
}

export function buildSearchQuery(params: {
  operators?: SearchOperators;
  freeText?: string;
}): string {
  const operators = params.operators ?? {};
  const fragments: string[] = [];

  for (const operator of OPERATOR_ORDER) {
    fragments.push(...buildOperatorFragment(operator, operators[operator]));
  }

  const freeText = normalizeWhitespace(params.freeText ?? "");

  if (freeText) {
    fragments.push(freeText);
  }

  return normalizeWhitespace(fragments.join(" "));
}

export function buildBatchQueries(input: {
  seed: string;
  site?: string;
  filetypes?: readonly string[];
  extraOperators?: Omit<SearchOperators, "filetype" | "site">;
}): Array<{ filetype: string; query: string }> {
  const seed = normalizeWhitespace(input.seed);
  const site = normalizeWhitespace(input.site ?? "");
  const filetypes =
    input.filetypes && input.filetypes.length > 0
      ? [...input.filetypes]
      : [...ALL_DISCOVERY_FILE_TYPES];

  return filetypes.map((filetype) => ({
    filetype,
    query: buildSearchQuery({
      operators: {
        ...input.extraOperators,
        ...(site ? { site } : {}),
        filetype,
      },
      freeText: seed,
    }),
  }));
}

export function buildTargetSweepQueries(input: {
  name?: string;
  email?: string;
  username?: string;
  domain?: string;
}): Record<string, string> {
  const name = normalizeWhitespace(input.name ?? "");
  const email = normalizeWhitespace(input.email ?? "");
  const username = normalizeWhitespace(input.username ?? "");
  const domain = normalizeWhitespace(input.domain ?? "");

  return {
    usernamePresence: buildSearchQuery({
      freeText: username,
      operators: username
        ? {
            site: [
              "github.com",
              "x.com",
              "twitter.com",
              "linkedin.com",
              "reddit.com",
              "instagram.com",
            ],
          }
        : {},
    }),
    emailDocuments: buildSearchQuery({
      freeText: email ? `"${escapeQuotedValue(email)}"` : "",
      operators: {
        ...(domain ? { site: domain } : {}),
        filetype: ["pdf", "docx", "xlsx", "txt"],
      },
    }),
    nameDocuments: buildSearchQuery({
      freeText: name ? `"${escapeQuotedValue(name)}"` : "",
      operators: {
        ...(domain ? { site: domain } : {}),
        filetype: ["pdf", "docx", "pptx"],
      },
    }),
    domainDiscovery: buildSearchQuery({
      freeText: domain,
      operators: domain
        ? {
            site: domain,
            filetype: [...ALL_DISCOVERY_FILE_TYPES],
          }
        : {},
    }),
  };
}

export function buildQueriesFromIdentifiers(
  identifiers: string[],
  options?: {
    site?: string;
    filetype?: string;
  },
): string[] {
  const unique = Array.from(
    new Set(
      identifiers
        .map((value) => normalizeWhitespace(value))
        .filter(Boolean),
    ),
  );

  return unique.map((identifier) =>
    buildSearchQuery({
      freeText: wrapValue(identifier),
      operators: {
        ...(options?.site ? { site: options.site } : {}),
        ...(options?.filetype ? { filetype: options.filetype } : {}),
      },
    }),
  );
}

export function getQueryTemplate(templateId: string): QueryTemplate | undefined {
  return QUERY_TEMPLATES.find((template) => template.id === templateId);
}
