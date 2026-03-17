import { z } from "zod";
import { env } from "@/lib/env";

const shodanHostSchema = z.object({
  ip_str: z.string(),
  org: z.string().optional(),
  isp: z.string().optional(),
  os: z.string().optional(),
  ports: z.array(z.number()),
  hostnames: z.array(z.string()),
  data: z.array(
    z.object({
      port: z.number(),
      transport: z.string(),
      product: z.string().optional(),
      version: z.string().optional(),
    })
  ).optional(),
});

export type ShodanHostResult = z.infer<typeof shodanHostSchema>;

export async function queryShodanHost(ip: string): Promise<ShodanHostResult | null> {
  const apiKey = env.SHODAN_API_KEY;
  if (!apiKey) {
    throw new Error("SHODAN_API_KEY is not configured.");
  }

  const url = `https://api.shodan.io/shodan/host/${ip}?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      next: { revalidate: 3600 },
    });

    if (response.status === 404 || response.status === 401 || response.status === 403) {
      if (response.status !== 404) console.warn(`Shodan authorization error: ${response.status}`);
      return null;
    }

    if (!response.ok) {
      throw new Error(`Shodan API returned ${response.status}`);
    }

    const json = await response.json();
    const parsed = shodanHostSchema.safeParse(json);

    if (!parsed.success) {
      console.error("Shodan parsing error:", parsed.error);
      throw new Error("Invalid Shodan response format.");
    }

    return parsed.data;
  } catch (error) {
    console.error(`Shodan error for ${ip}:`, error);
    return null;
  }
}

export async function resolveDomainToIp(domain: string): Promise<string | null> {
  // Simple DNS resolution via Google DoH
  try {
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
    const json = await response.json();
    if (json.Answer && json.Answer.length > 0) {
      return json.Answer[0].data;
    }
    return null;
  } catch (error) {
    console.error(`DNS resolve error for ${domain}:`, error);
    return null;
  }
}
