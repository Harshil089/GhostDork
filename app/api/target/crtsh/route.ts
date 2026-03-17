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
import { queryCrtsh } from "@/lib/api/crtsh";

const MAX_CRTSH_REQUEST_BYTES = 64 * 1024;

const crtshRequestSchema = z.object({
  domain: z.string().min(1, "Domain is required."),
});

export async function POST(request: Request) {
  try {
    const json = await parseJsonBodyWithLimit(request, MAX_CRTSH_REQUEST_BYTES);
    const parsed = crtshRequestSchema.safeParse(json);

    if (!parsed.success) {
      return apiBadRequest(
        "Invalid crt.sh request.",
        parsed.error.flatten().formErrors.join(" ") ||
          Object.values(parsed.error.flatten().fieldErrors)
            .flat()
            .filter(Boolean)
            .join(" "),
      );
    }

    const { domain } = parsed.data;
    const result = await queryCrtsh(domain);

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return apiPayloadTooLarge(
        "Payload too large.",
        `Request body exceeds ${MAX_CRTSH_REQUEST_BYTES} bytes.`,
      );
    }

    if (error instanceof RequestBodyParseError) {
      return apiBadRequest("Invalid JSON body.", error.message);
    }

    console.error("crt.sh lookup failed.", error);
    return apiServerError("crt.sh lookup failed.");
  }
}
