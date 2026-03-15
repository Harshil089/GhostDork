import { NextRequest } from "next/server";
import { z } from "zod";

import { apiBadRequest, apiServerError, apiSuccess } from "@/lib/api/http";
import { runTargetSweep } from "@/lib/osint-service";
import type { SweepTargetType } from "@/lib/types/osint";

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
    const body = await request.json();
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
    if (error instanceof SyntaxError) {
      return apiBadRequest("Invalid JSON body.");
    }

    return apiServerError(
      error instanceof Error ? error.message : "Failed to execute target sweep.",
    );
  }
}
