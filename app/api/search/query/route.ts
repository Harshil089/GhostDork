import { NextRequest } from "next/server";
import { z } from "zod";

import {
  apiBadRequest,
  apiServerError,
  apiSuccess,
  apiUnprocessableEntity,
} from "@/lib/api/http";
import { runStructuredQuery } from "@/lib/osint-service";
import type { StructuredQueryInput } from "@/lib/types/osint";

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
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return apiBadRequest("Invalid JSON body.");
    }

    const parsed = structuredQuerySchema.safeParse(body);

    if (!parsed.success) {
      return apiUnprocessableEntity(
        "Invalid structured query payload.",
        parsed.error.issues.map((issue) => issue.message).join(" "),
      );
    }

    const input = toStructuredInput(parsed.data);
    const result = await runStructuredQuery(input, {
      start: parsed.data.start,
      num: parsed.data.num,
      cache: parsed.data.cache,
      serpApiContext: "build-query",
    });

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error) {
      return apiServerError(
        "Failed to execute structured search query.",
        error.message,
      );
    }

    return apiServerError("Failed to execute structured search query.");
  }
}
