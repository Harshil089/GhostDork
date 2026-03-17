import { z } from "zod";
import { apiBadRequest, apiServerError, apiSuccess } from "@/lib/api/http";
import { queryCrtsh } from "@/lib/api/crtsh";

const crtshRequestSchema = z.object({
  domain: z.string().min(1, "Domain is required."),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
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
    if (error instanceof SyntaxError) {
      return apiBadRequest("Invalid JSON body.", "Request body must be valid JSON.");
    }
    if (error instanceof Error) {
      return apiServerError("crt.sh lookup failed.", error.message);
    }
    return apiServerError("crt.sh lookup failed.");
  }
}
