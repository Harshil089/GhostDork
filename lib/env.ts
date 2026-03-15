import { z } from "zod";

const serverEnvSchema = z.object({
  GOOGLE_CSE_API_KEY: z.string().min(1).optional(),
  GOOGLE_CSE_ID: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const parsedEnv = serverEnvSchema.safeParse({
  GOOGLE_CSE_API_KEY: process.env.GOOGLE_CSE_API_KEY,
  GOOGLE_CSE_ID: process.env.GOOGLE_CSE_ID,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
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
  googleSearch: hasEnv("GOOGLE_CSE_API_KEY") && hasEnv("GOOGLE_CSE_ID"),
  openaiVision: hasEnv("OPENAI_API_KEY"),
  redisCache:
    hasEnv("UPSTASH_REDIS_REST_URL") && hasEnv("UPSTASH_REDIS_REST_TOKEN"),
} as const;
