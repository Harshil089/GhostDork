import { z } from "zod";

const serverEnvSchema = z.object({
  SERPAPI_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  SHODAN_API_KEY: z
    .string()
    .regex(/^[A-Za-z0-9]{32}$/, "SHODAN_API_KEY must be a 32-character alphanumeric key")
    .optional(),
  AUTH_PASSWORD: z.string().min(1).optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Coerce empty strings (from .env files with `KEY=`) to undefined so optional() works. */
function emptyToUndefined(value: string | undefined) {
  return value?.trim() ? value.trim() : undefined;
}

const parsedEnv = serverEnvSchema.safeParse({
  SERPAPI_API_KEY: emptyToUndefined(process.env.SERPAPI_API_KEY),
  GEMINI_API_KEY: emptyToUndefined(process.env.GEMINI_API_KEY),
  UPSTASH_REDIS_REST_URL: emptyToUndefined(process.env.UPSTASH_REDIS_REST_URL),
  UPSTASH_REDIS_REST_TOKEN: emptyToUndefined(process.env.UPSTASH_REDIS_REST_TOKEN),
  SHODAN_API_KEY: emptyToUndefined(process.env.SHODAN_API_KEY),
  AUTH_PASSWORD: emptyToUndefined(process.env.AUTH_PASSWORD),
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsedEnv.success) {
  console.error(
    "Invalid environment variables:",
    parsedEnv.error.flatten().fieldErrors,
  );
  throw new Error("Environment variable validation failed.");
}

export const env = parsedEnv.data;

export function getRequiredEnv<K extends keyof ServerEnv>(key: K): string {
  const value = env[key];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function hasEnv<K extends keyof ServerEnv>(key: K): boolean {
  const value = env[key];
  return typeof value === "string" && value.length > 0;
}

export function requireEnv(keys: Array<keyof ServerEnv>): void {
  const missing = keys.filter((key) => !hasEnv(key));

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}

export const featureAvailability = {
  googleSearch: hasEnv("SERPAPI_API_KEY"),
  vision: hasEnv("GEMINI_API_KEY"),
  redisCache:
    hasEnv("UPSTASH_REDIS_REST_URL") && hasEnv("UPSTASH_REDIS_REST_TOKEN"),
  shodan: hasEnv("SHODAN_API_KEY"),
} as const;
