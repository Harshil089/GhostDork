import { NextRequest } from "next/server";
import { z } from "zod";

import { apiBadRequest, apiServerError, apiSuccess } from "@/lib/api/http";
import { analyzeImagePipeline } from "@/lib/osint-service";

const imageAnalysisRequestSchema = z
  .object({
    imageUrl: z.string().url().optional(),
    imageBase64: z.string().min(1).optional(),
    filename: z.string().min(1).max(256).optional(),
    sourceType: z.enum(["upload", "url"]),
  })
  .superRefine((value, ctx) => {
    if (value.sourceType === "url" && !value.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageUrl"],
        message: "An imageUrl is required when sourceType is 'url'.",
      });
    }

    if (value.sourceType === "upload" && !value.imageBase64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageBase64"],
        message: "An imageBase64 payload is required when sourceType is 'upload'.",
      });
    }
  });

function formatValidationErrors(
  issues: z.ZodIssue[],
): string {
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "request";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = imageAnalysisRequestSchema.safeParse(body);

    if (!parsed.success) {
      return apiBadRequest(
        "Invalid image analysis request.",
        formatValidationErrors(parsed.error.issues),
      );
    }

    const result = await analyzeImagePipeline(parsed.data);

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return apiBadRequest(
        "Invalid JSON body.",
        "Request body must be valid JSON.",
      );
    }

    if (error instanceof Error) {
      return apiServerError(
        "Image analysis failed.",
        error.message,
      );
    }

    return apiServerError("Image analysis failed.");
  }
}
