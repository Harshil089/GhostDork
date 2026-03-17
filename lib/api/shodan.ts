import { z } from "zod";
import { env } from "@/lib/env";

const ipv4Regex = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function isIpv4(value: string): boolean {
  return ipv4Regex.test(value.trim());
}

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

const shodanInternetDbSchema = z.object({
  ip: z.string(),
  ports: z.array(z.number()).default([]),
  hostnames: z.array(z.string()).default([]),
  cpes: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  vulns: z.array(z.string()).default([]),
});

const shodanApiInfoSchema = z.object({
  plan: z.string().optional(),
  query_credits: z.number().optional(),
  scan_credits: z.number().optional(),
  unlocked: z.boolean().optional(),
});

export type ShodanHostResult = z.infer<typeof shodanHostSchema>;

type ShodanApiInfo = z.infer<typeof shodanApiInfoSchema>;

async function getShodanApiInfo(apiKey: string): Promise<ShodanApiInfo | null> {
  const response = await fetch(
    `https://api.shodan.io/api-info?key=${encodeURIComponent(apiKey)}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  const parsed = shodanApiInfoSchema.safeParse(json);

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

async function queryShodanInternetDb(ip: string): Promise<ShodanHostResult | null> {
  const response = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Shodan InternetDB returned ${response.status}`);
  }

  const json = await response.json();
  const parsed = shodanInternetDbSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error("Invalid Shodan InternetDB response format.");
  }

  return {
    ip_str: parsed.data.ip,
    ports: parsed.data.ports,
    hostnames: parsed.data.hostnames,
    data: parsed.data.ports.map((port) => ({
      port,
      transport: "tcp",
    })),
  };
}

export async function queryShodanHost(ip: string): Promise<ShodanHostResult | null> {
  const apiKey = env.SHODAN_API_KEY;
  if (!apiKey) {
    throw new Error("SHODAN_API_KEY is not configured.");
  }

  const normalizedIp = ip.trim();
  if (!isIpv4(normalizedIp)) {
    throw new Error(`Invalid IPv4 address for Shodan lookup: ${normalizedIp}`);
  }

  const apiInfo = await getShodanApiInfo(apiKey);
  const queryCredits = apiInfo?.query_credits;

  if (typeof queryCredits === "number" && queryCredits <= 0) {
    return queryShodanInternetDb(normalizedIp);
  }

  const url = `https://api.shodan.io/shodan/host/${encodeURIComponent(normalizedIp)}?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (response.status === 404) {
      return null;
    }

    if (response.status === 401 || response.status === 403) {
      try {
        return await queryShodanInternetDb(normalizedIp);
      } catch {
        throw new Error("Shodan authentication failed. Verify SHODAN_API_KEY and available query credits.");
      }
    }

    if (response.status === 429) {
      try {
        return await queryShodanInternetDb(normalizedIp);
      } catch {
        throw new Error("Shodan rate limit reached. Please retry in a moment.");
      }
    }

    if (!response.ok) {
      const fallback = `Shodan API returned ${response.status}`;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const errorJson = (await response.json()) as { error?: string };
        throw new Error(errorJson.error ?? fallback);
      }

      const body = await response.text();
      throw new Error(body || fallback);
    }

    const json = await response.json();
    const parsed = shodanHostSchema.safeParse(json);

    if (!parsed.success) {
      console.error("Shodan parsing error:", parsed.error);
      throw new Error("Invalid Shodan response format.");
    }

    return parsed.data;
  } catch (error) {
    console.error(`Shodan error for ${normalizedIp}:`, error);
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unknown Shodan lookup error.");
  }
}

export async function resolveDomainToIp(domain: string): Promise<string | null> {
  // Simple DNS resolution via Google DoH
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain.trim())}&type=A`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      Answer?: Array<{ type?: number; data?: string }>;
    };

    if (Array.isArray(json.Answer) && json.Answer.length > 0) {
      const ipv4Answer = json.Answer.find(
        (answer) => answer.type === 1 && typeof answer.data === "string" && isIpv4(answer.data),
      );

      if (ipv4Answer?.data) {
        return ipv4Answer.data;
      }
    }

    return null;
  } catch (error) {
    console.error(`DNS resolve error for ${domain}:`, error);
    return null;
  }
}
