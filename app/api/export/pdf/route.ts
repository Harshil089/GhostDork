import { z } from "zod";

import { createPdfResponse, type JsonObject, type JsonValue } from "@/lib/pdf";
import { apiBadRequest, apiServerError } from "@/lib/api/http";

const exportPdfSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  subtitle: z.string().trim().max(400).optional(),
  generatedAt: z.string().trim().optional(),
  footerText: z.string().trim().max(300).optional(),
  maxDepth: z.number().int().min(1).max(10).optional(),
  payload: z.record(z.string(), z.unknown()),
});

function sanitizeJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (typeof value === "object") {
    const output: JsonObject = {};

    for (const [key, entry] of Object.entries(value)) {
      output[key] = sanitizeJsonValue(entry);
    }

    return output;
  }

  return String(value);
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = exportPdfSchema.safeParse(json);

    if (!parsed.success) {
      return apiBadRequest(
        "Invalid PDF export request.",
        parsed.error.issues.map((issue) => issue.message).join("; "),
      );
    }

    const { payload, title, subtitle, generatedAt, footerText, maxDepth } =
      parsed.data;

    return await createPdfResponse(sanitizeJsonValue(payload) as JsonObject, {
      title: title ?? "GhostDork Research Report",
      subtitle,
      generatedAt,
      footerText,
      maxDepth,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return apiBadRequest(
        "Invalid JSON body.",
        "Request body must be valid JSON.",
      );
    }

    return apiServerError(
      "Failed to generate PDF export.",
      error instanceof Error ? error.message : "Unknown error.",
    );
  }
}
