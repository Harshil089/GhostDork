import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import {
  apiBadRequest,
  apiPayloadTooLarge,
  apiServerError,
  apiSuccess,
  apiUnprocessableEntity,
  parseJsonBodyWithLimit,
  RequestBodyParseError,
  RequestBodyTooLargeError,
} from "@/lib/api/http";
import { runStructuredQuery } from "@/lib/osint-service";
import type { StructuredQueryInput } from "@/lib/types/osint";

const MAX_QUERY_REQUEST_BYTES = 256 * 1024;
const ACTOR_HEADER_NAME = "x-ghostdork-actor";
const ACTOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const structuredQuerySchema = z
  .object({
    site: z.string().trim().optional().or(z.literal("")),
    inurl: z.string().trim().optional().or(z.literal("")),
    intitle: z.string().trim().optional().or(z.literal("")),
    intext: z.string().trim().optional().or(z.literal("")),
    filetype: z.string().trim().optional().or(z.literal("")),
    before: z.string().trim().optional().or(z.literal("")),
    after: z.string().trim().optional().or(z.literal("")),
    freeText: z.string().trim().optional().or(z.literal("")),
    exactTerms: z
      .union([z.string().trim(), z.array(z.string().trim())])
      .optional(),
    excludeTerms: z
      .union([z.string().trim(), z.array(z.string().trim())])
      .optional(),
    start: z.coerce.number().int().min(1).max(91).optional(),
    num: z.coerce.number().int().min(1).max(10).optional(),
    cache: z.boolean().optional(),
    expansionRounds: z.coerce.number().int().min(0).max(2).optional(),
    expansionQueriesPerRound: z.coerce.number().int().min(1).max(4).optional(),
    expansionMinScore: z.coerce.number().min(0).max(1).optional(),
  })
  .superRefine((value, ctx) => {
    const hasQueryInput = [
      value.site,
      value.inurl,
      value.intitle,
      value.intext,
      value.filetype,
      value.before,
      value.after,
      value.freeText,
      value.exactTerms,
      value.excludeTerms,
    ].some((entry) => {
      if (Array.isArray(entry)) {
        return entry.some((item) => item.trim().length > 0);
      }

      return typeof entry === "string" ? entry.trim().length > 0 : Boolean(entry);
    });

    if (!hasQueryInput) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "At least one query input is required: freeText, an operator field, exactTerms, or excludeTerms.",
        path: ["freeText"],
      });
    }
  });

function normalizeList(value?: string | string[]): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const list = Array.isArray(value) ? value : value.split(/[,\\n]/g);

  const normalized = Array.from(
    new Set(list.map((item) => item.trim()).filter(Boolean)),
  );

  return normalized.length > 0 ? normalized : undefined;
}

function toStructuredInput(
  payload: z.infer<typeof structuredQuerySchema>,
): StructuredQueryInput {
  return {
    site: payload.site || undefined,
    inurl: payload.inurl || undefined,
    intitle: payload.intitle || undefined,
    intext: payload.intext || undefined,
    filetype: payload.filetype || undefined,
    before: payload.before || undefined,
    after: payload.after || undefined,
    freeText: payload.freeText || undefined,
    exactTerms: normalizeList(payload.exactTerms),
    excludeTerms: normalizeList(payload.excludeTerms),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBodyWithLimit(request, MAX_QUERY_REQUEST_BYTES);

    const parsed = structuredQuerySchema.safeParse(body);

    if (!parsed.success) {
      return apiUnprocessableEntity(
        "Invalid structured query payload.",
        parsed.error.issues.map((issue) => issue.message).join(" "),
      );
    }

    const input = toStructuredInput(parsed.data);
    const actorId = request.headers.get(ACTOR_HEADER_NAME)?.trim();
    const stableIdentity =
      actorId && ACTOR_ID_PATTERN.test(actorId)
        ? `actor:${actorId}`
        : (request as NextRequest & { ip?: string }).ip?.trim() ||
          request.headers.get("cf-connecting-ip")?.trim() ||
          request.headers.get("x-real-ip")?.trim() ||
          "unknown";
    const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, 140);
    const expansionBudgetScopeKey = createHash("sha256")
      .update(`${stableIdentity}:${userAgent}`)
      .digest("hex")
      .slice(0, 24);

    const result = await runStructuredQuery(input, {
      start: parsed.data.start,
      num: parsed.data.num,
      cache: parsed.data.cache,
      serpApiContext: "build-query",
      expansionRounds: parsed.data.expansionRounds,
      expansionQueriesPerRound: parsed.data.expansionQueriesPerRound,
      expansionMinScore: parsed.data.expansionMinScore,
      expansionBudgetScopeKey,
    });

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return apiPayloadTooLarge(
        "Payload too large.",
        `Request body exceeds ${MAX_QUERY_REQUEST_BYTES} bytes.`,
      );
    }

    if (error instanceof RequestBodyParseError) {
      return apiBadRequest("Invalid JSON body.", error.message);
    }

    console.error("Failed to execute structured search query.", error);
    return apiServerError("Failed to execute structured search query.");
  }
}
