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
  requireContentType,
} from "@/lib/api/http";
import { analyzeImagePipeline } from "@/lib/osint-service";

const MAX_IMAGE_ANALYZE_REQUEST_BYTES = 22 * 1024 * 1024;

const imageAnalysisRequestSchema = z
  .object({
    imageUrl: z
      .string()
      .url()
      .refine((value) => {
        try {
          const protocol = new URL(value).protocol;
          return protocol === "http:" || protocol === "https:";
        } catch {
          return false;
        }
      }, "imageUrl must use http or https protocol.")
      .optional(),
    imageBase64: z.string().min(1).max(20 * 1024 * 1024).optional(),
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
  // Validate Content-Type
  const contentTypeError = requireContentType(
    request.headers.get("content-type"),
  );
  if (contentTypeError) {
    return contentTypeError;
  }

  try {
    const body = await parseJsonBodyWithLimit(request, MAX_IMAGE_ANALYZE_REQUEST_BYTES);
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
    if (error instanceof RequestBodyTooLargeError) {
      return apiPayloadTooLarge(
        "Payload too large.",
        `Request body exceeds ${MAX_IMAGE_ANALYZE_REQUEST_BYTES} bytes.`,
      );
    }

    if (error instanceof RequestBodyParseError) {
      return apiBadRequest(
        "Invalid JSON body.",
        error.message,
      );
    }

    console.error("Image analysis failed.", error);

    return apiServerError();
  }
}
