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
import { queryShodanHost, resolveDomainToIp } from "@/lib/api/shodan";

const MAX_SHODAN_REQUEST_BYTES = 64 * 1024;

const shodanRequestSchema = z.object({
  ipOrDomain: z.string().min(1, "IP or Domain is required."),
});

export async function POST(request: Request) {
  try {
    const json = await parseJsonBodyWithLimit(request, MAX_SHODAN_REQUEST_BYTES);
    const parsed = shodanRequestSchema.safeParse(json);

    if (!parsed.success) {
      return apiBadRequest(
        "Invalid Shodan request.",
        parsed.error.flatten().formErrors.join(" ") ||
          Object.values(parsed.error.flatten().fieldErrors)
            .flat()
            .filter(Boolean)
            .join(" "),
      );
    }

    const { ipOrDomain } = parsed.data;
    
    // Auto-resolve domain to IP if it doesn't look like an IP address
    let targetIp = ipOrDomain;
    if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ipOrDomain)) {
      const resolvedIp = await resolveDomainToIp(ipOrDomain);
      if (!resolvedIp) {
        return apiBadRequest("Invalid Target", "Could not resolve domain to IP address for Shodan.");
      }
      targetIp = resolvedIp;
    }

    let result = null;
    try {
      result = await queryShodanHost(targetIp);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Invalid IPv4 address")) {
          return apiBadRequest("Invalid Target", "Resolved target is not a valid IPv4 address for Shodan lookup.");
        }

        if (
          error.message.includes("Shodan authentication failed") ||
          error.message.includes("Shodan rate limit reached")
        ) {
          return apiSuccess({
            found: false,
            host: targetIp,
            unavailableReason: "shodan-auth-or-quota",
            message: error.message,
          });
        }
      }

      throw error;
    }
    
    if (!result) {
      return apiSuccess({ found: false, host: targetIp });
    }

    return apiSuccess({ found: true, data: result });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return apiPayloadTooLarge(
        "Payload too large.",
        `Request body exceeds ${MAX_SHODAN_REQUEST_BYTES} bytes.`,
      );
    }

    if (error instanceof RequestBodyParseError) {
      return apiBadRequest("Invalid JSON body.", error.message);
    }

    console.error("Shodan lookup failed.", error);
    return apiServerError("Shodan lookup failed.");
  }
}
