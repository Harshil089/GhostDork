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
import { runBatchDiscovery } from "@/lib/osint-service";

const MAX_BATCH_REQUEST_BYTES = 128 * 1024;

const batchDiscoveryRequestSchema = z.object({
  target: z.string().min(1, "Target is required."),
  includeConfigFormats: z.boolean().optional(),
  includeArchiveFormats: z.boolean().optional(),
  extensions: z.array(z.string().min(1)).optional(),
  maxResultsPerQuery: z.number().int().min(1).max(10).optional(),
  skipHistory: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await parseJsonBodyWithLimit(request, MAX_BATCH_REQUEST_BYTES);
    const parsed = batchDiscoveryRequestSchema.safeParse(json);

    if (!parsed.success) {
      return apiBadRequest(
        "Invalid batch discovery request.",
        parsed.error.flatten().formErrors.join(" ") ||
          Object.values(parsed.error.flatten().fieldErrors)
            .flat()
            .filter(Boolean)
            .join(" "),
      );
    }

    const result = await runBatchDiscovery(parsed.data);

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return apiPayloadTooLarge(
        "Payload too large.",
        `Request body exceeds ${MAX_BATCH_REQUEST_BYTES} bytes.`,
      );
    }

    if (error instanceof RequestBodyParseError) {
      return apiBadRequest("Invalid JSON body.", error.message);
    }

    console.error("Batch discovery failed.", error);
    return apiServerError("Batch discovery failed.");
  }
}
