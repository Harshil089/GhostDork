import { z } from "zod";

import { apiBadRequest, apiServerError, apiSuccess } from "@/lib/api/http";
import { runBatchDiscovery } from "@/lib/osint-service";

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
    const json = await request.json();
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
    if (error instanceof SyntaxError) {
      return apiBadRequest(
        "Invalid JSON body.",
        "Request body must be valid JSON.",
      );
    }

    if (error instanceof Error) {
      return apiServerError("Batch discovery failed.", error.message);
    }

    return apiServerError("Batch discovery failed.");
  }
}
