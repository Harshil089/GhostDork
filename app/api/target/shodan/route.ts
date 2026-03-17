import { z } from "zod";
import { apiBadRequest, apiServerError, apiSuccess } from "@/lib/api/http";
import { queryShodanHost, resolveDomainToIp } from "@/lib/api/shodan";

const shodanRequestSchema = z.object({
  ipOrDomain: z.string().min(1, "IP or Domain is required."),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
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

    const result = await queryShodanHost(targetIp);
    
    if (!result) {
      return apiSuccess({ found: false, host: targetIp });
    }

    return apiSuccess({ found: true, data: result });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return apiBadRequest("Invalid JSON body.", "Request body must be valid JSON.");
    }
    if (error instanceof Error) {
      return apiServerError("Shodan lookup failed.", error.message);
    }
    return apiServerError("Shodan lookup failed.");
  }
}
