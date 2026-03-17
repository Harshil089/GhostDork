import { z } from "zod";

const crtshResponseSchema = z.array(
  z.object({
    issuer_ca_id: z.number(),
    issuer_name: z.string(),
    common_name: z.string(),
    name_value: z.string(),
    id: z.number(),
    entry_timestamp: z.string(),
    not_before: z.string(),
    not_after: z.string(),
    serial_number: z.string(),
  })
);

export type CrtshResult = {
  domain: string;
  subdomains: string[];
};

export async function queryCrtsh(domain: string): Promise<CrtshResult> {
  const url = `https://crt.sh/?q=%.${domain}&output=json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`crt.sh API returned ${response.status}`);
      return { domain, subdomains: [] };
    }

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      console.error("crt.sh returned invalid JSON (likely an error page).");
      return { domain, subdomains: [] };
    }
    const parsed = crtshResponseSchema.safeParse(json);

    if (!parsed.success) {
      throw new Error("Invalid crt.sh response format.");
    }

    const subdomains = new Set<string>();
    for (const cert of parsed.data) {
      const names = cert.name_value.split("\n");
      for (const name of names) {
        const cleanName = name.trim().toLowerCase();
        if (cleanName.endsWith(`.${domain.toLowerCase()}`) || cleanName === domain.toLowerCase()) {
          // Ignore wildcards for simplicity of exact subdomains, or keep them but strip *.
          const normalized = cleanName.replace(/^\*\./, "");
          subdomains.add(normalized);
        }
      }
    }

    return {
      domain,
      subdomains: Array.from(subdomains).sort(),
    };
  } catch (error) {
    console.error(`crt.sh error for ${domain}:`, error);
    return {
      domain,
      subdomains: [],
    };
  }
}
