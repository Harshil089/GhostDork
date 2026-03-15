import OpenAI from "openai";

export type VisionEntityType =
  | "name"
  | "username"
  | "email"
  | "phone"
  | "domain"
  | "organization"
  | "location"
  | "handle"
  | "other";

export interface VisionEntity {
  type: VisionEntityType;
  value: string;
  confidence: number;
  sourceText?: string;
  notes?: string;
}

export interface VisionAnalysisResult {
  summary: string;
  entities: VisionEntity[];
  notableText: string[];
  suggestedQueries: string[];
  raw?: unknown;
}

const OPENAI_MODEL = "gpt-4o";

let cachedClient: OpenAI | null = null;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey });
  }

  return cachedClient;
}

function normalizeEntityType(value: string): VisionEntityType {
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "name" ||
    normalized === "username" ||
    normalized === "email" ||
    normalized === "phone" ||
    normalized === "domain" ||
    normalized === "organization" ||
    normalized === "location" ||
    normalized === "handle"
  ) {
    return normalized;
  }

  return "other";
}

function sanitizeConfidence(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }

  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildSuggestedQueries(entities: VisionEntity[]) {
  const queries = new Set<string>();

  for (const entity of entities) {
    const wrapped = `"${entity.value}"`;

    switch (entity.type) {
      case "email":
        queries.add(wrapped);
        queries.add(`${wrapped} filetype:pdf`);
        queries.add(`${wrapped} filetype:docx`);
        break;
      case "username":
      case "handle":
        queries.add(wrapped);
        queries.add(`${wrapped} site:github.com`);
        queries.add(`${wrapped} site:linkedin.com OR site:x.com OR site:instagram.com`);
        break;
      case "name":
        queries.add(wrapped);
        queries.add(`${wrapped} filetype:pdf`);
        break;
      case "domain":
        queries.add(`site:${entity.value}`);
        queries.add(`site:${entity.value} filetype:pdf`);
        break;
      case "organization":
        queries.add(wrapped);
        queries.add(`${wrapped} filetype:pdf OR filetype:pptx`);
        break;
      default:
        queries.add(wrapped);
        break;
    }
  }

  return [...queries];
}

function extractJsonPayload(content: string) {
  const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  throw new Error("OpenAI response did not contain valid JSON.");
}

export async function analyzeImageWithOpenAI(input: {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  ocrText?: string;
}) {
  if (!input.imageUrl && !input.imageBase64) {
    throw new Error("Either imageUrl or imageBase64 must be provided.");
  }

  const client = getOpenAIClient();

  const imagePart = input.imageBase64
    ? {
        type: "image_url" as const,
        image_url: {
          url: `data:${input.mimeType ?? "image/png"};base64,${input.imageBase64}`,
        },
      }
    : {
        type: "image_url" as const,
        image_url: {
          url: input.imageUrl!,
        },
      };

  const prompt = [
    "You are an OSINT research assistant for authorized, educational analysis.",
    "Analyze the provided image and extract visible identifiers that could support lawful research workflows.",
    "Use the OCR text as a hint, but prefer what is visibly present in the image.",
    "Return only strict JSON with this exact shape:",
    "{",
    '  "summary": "short summary",',
    '  "notableText": ["text"],',
    '  "entities": [',
    "    {",
    '      "type": "name|username|email|phone|domain|organization|location|handle|other",',
    '      "value": "string",',
    '      "confidence": 0.0,',
    '      "sourceText": "string",',
    '      "notes": "string"',
    "    }",
    "  ]",
    "}",
    "Do not include markdown or commentary.",
    input.ocrText ? `OCR hint:\n${input.ocrText}` : "OCR hint: none provided.",
  ].join("\n");

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract structured identifiers from images and respond with strict JSON only.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
          imagePart,
        ],
      },
    ],
  });

  const message = response.choices[0]?.message?.content;

  if (!message) {
    throw new Error("OpenAI returned an empty response.");
  }

  const parsed = JSON.parse(extractJsonPayload(message)) as {
    summary?: unknown;
    notableText?: unknown;
    entities?: Array<{
      type?: unknown;
      value?: unknown;
      confidence?: unknown;
      sourceText?: unknown;
      notes?: unknown;
    }>;
  };

  const entities = Array.isArray(parsed.entities)
    ? parsed.entities
        .map((entity) => {
          if (typeof entity?.value !== "string" || !entity.value.trim()) {
            return null;
          }

          return {
            type: normalizeEntityType(String(entity.type ?? "other")),
            value: entity.value.trim(),
            confidence: sanitizeConfidence(entity.confidence),
            sourceText:
              typeof entity.sourceText === "string" ? entity.sourceText.trim() : undefined,
            notes: typeof entity.notes === "string" ? entity.notes.trim() : undefined,
          } satisfies VisionEntity;
        })
        .filter((entity) => Boolean(entity)) as VisionEntity[]
    : [];

  const notableText = Array.isArray(parsed.notableText)
    ? dedupeStrings(parsed.notableText.filter((item): item is string => typeof item === "string"))
    : [];

  return {
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "Structured image analysis completed.",
    entities,
    notableText,
    suggestedQueries: buildSuggestedQueries(entities),
    raw: parsed,
  } satisfies VisionAnalysisResult;
}

export async function generateFollowUpQueriesFromText(values: string[]) {
  const cleaned = dedupeStrings(values);

  if (cleaned.length === 0) {
    return [];
  }

  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You generate concise Google Custom Search queries for authorized OSINT research. Return JSON only.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "Create up to 12 Google Custom Search query strings from these extracted identifiers.",
              "Focus on public documents, profile discovery, and domain pivots.",
              'Return JSON with shape: { "queries": ["..."] }',
              `Identifiers: ${cleaned.join(", ")}`,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const message = response.choices[0]?.message?.content;

  if (!message) {
    return cleaned.map((value) => `"${value}"`);
  }

  const parsed = JSON.parse(extractJsonPayload(message)) as {
    queries?: unknown;
  };

  if (!Array.isArray(parsed.queries)) {
    return cleaned.map((value) => `"${value}"`);
  }

  return dedupeStrings(
    parsed.queries.filter((query): query is string => typeof query === "string"),
  );
}
