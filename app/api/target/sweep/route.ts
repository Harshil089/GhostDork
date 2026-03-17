import { NextRequest } from "next/server";
import { z } from "zod";

import {
  apiBadRequest,
  apiPayloadTooLarge,
  apiServerError,
  apiSuccess,
  parseJsonBodyWithLimit,
  RequestBodyParseError,
  RequestBodyTooLargeError,
} from "@/lib/api/http";
import { runTargetSweep } from "@/lib/osint-service";
import type { SweepTargetType } from "@/lib/types/osint";

const MAX_TARGET_SWEEP_REQUEST_BYTES = 128 * 1024;

const targetSweepRequestSchema = z.object({
  target: z.string().trim().min(1, "Target is required."),
  type: z.enum(["name", "email", "username", "domain"]).optional(),
  maxResultsPerQuery: z.coerce.number().int().min(1).max(10).optional(),
});

function inferTargetType(target: string): SweepTargetType {
  const normalized = target.trim();

  if (normalized.includes("@")) {
    return "email";
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
    return "domain";
  }

  if (/^[a-z0-9._-]{3,}$/i.test(normalized) && !/\s/.test(normalized)) {
    return "username";
  }

  return "name";
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBodyWithLimit(request, MAX_TARGET_SWEEP_REQUEST_BYTES);
    const parsed = targetSweepRequestSchema.safeParse(body);

    if (!parsed.success) {
      return apiBadRequest(
        "Invalid target sweep request.",
        parsed.error.issues.map((issue) => issue.message).join(" "),
      );
    }

    const normalizedTarget = parsed.data.target.trim();
    const resolvedType = parsed.data.type ?? inferTargetType(normalizedTarget);

    const response = await runTargetSweep({
      target: normalizedTarget,
      type: resolvedType,
      maxResultsPerQuery: parsed.data.maxResultsPerQuery,
    });

    return apiSuccess(response);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return apiPayloadTooLarge(
        "Payload too large.",
        `Request body exceeds ${MAX_TARGET_SWEEP_REQUEST_BYTES} bytes.`,
      );
    }

    if (error instanceof RequestBodyParseError) {
      return apiBadRequest("Invalid JSON body.", error.message);
    }

    console.error("Failed to execute target sweep.", error);
    return apiServerError("Failed to execute target sweep.");
  }
}
