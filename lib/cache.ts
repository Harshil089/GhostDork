import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export type CacheableData = any;

export interface HistoryEntry<T extends CacheableData = CacheableData> {
  id: string;
  type:
    | "structured-query"
    | "batch-discovery"
    | "image-analysis"
    | "target-sweep"
    | "export";
  title: string;
  query: string;
  target?: string;
  tags?: string[];
  createdAt: string;
  ttlSeconds?: number;
  payload: T;
}

interface CacheEnvelope<T extends CacheableData = CacheableData> {
  key: string;
  createdAt: string;
  ttlSeconds: number;
  data: T;
}

interface SetCacheOptions {
  ttlSeconds?: number;
}

interface AppendHistoryOptions {
  sessionId?: string;
  maxEntries?: number;
}

const DEFAULT_CACHE_TTL_SECONDS = 60 * 60;
const DEFAULT_HISTORY_LIMIT = 50;
const GLOBAL_HISTORY_KEY = "ghostdork:history:global";

function hasRedisEnv() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function createRedisClient() {
  if (!hasRedisEnv()) {
    return null;
  }

  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

const redis = createRedisClient();

const memoryCache = new Map<string, CacheEnvelope>();
const memoryHistory = new Map<string, HistoryEntry[]>();

function getSessionHistoryKey(sessionId?: string) {
  return sessionId
    ? `ghostdork:history:session:${sessionId}`
    : GLOBAL_HISTORY_KEY;
}

function createHistoryId(prefix: string) {
  // Use cryptographically secure random UUID instead of predictable Math.random()
  return `${prefix}_${randomUUID()}`;
}

function isExpired(entry: CacheEnvelope) {
  const expiresAt =
    new Date(entry.createdAt).getTime() + entry.ttlSeconds * 1000;
  return Date.now() > expiresAt;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildCacheKey(namespace: string, input: unknown) {
  const serialized =
    typeof input === "string" ? input : JSON.stringify(input ?? {});
  // Hash the serialized input to prevent cache poisoning attacks
  const hash = createHash("sha256").update(serialized).digest("hex");
  return `ghostdork:${namespace}:${hash}`;
}

export async function getCache<T extends CacheableData = CacheableData>(
  key: string,
): Promise<T | null> {
  if (redis) {
    const result = await redis.get<CacheEnvelope<T> | T>(key);

    if (!result) {
      return null;
    }

    if (
      typeof result === "object" &&
      result !== null &&
      "data" in result &&
      "createdAt" in result &&
      "ttlSeconds" in result
    ) {
      return clone((result as CacheEnvelope<T>).data);
    }

    return clone(result as T);
  }

  const cached = memoryCache.get(key);

  if (!cached) {
    return null;
  }

  if (isExpired(cached)) {
    memoryCache.delete(key);
    return null;
  }

  return clone(cached.data as T);
}

export async function setCache<T extends CacheableData = CacheableData>(
  key: string,
  data: T,
  options: SetCacheOptions = {},
): Promise<void> {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;
  const envelope: CacheEnvelope<T> = {
    key,
    createdAt: new Date().toISOString(),
    ttlSeconds,
    data: clone(data),
  };

  if (redis) {
    await redis.set(key, envelope, { ex: ttlSeconds });
    return;
  }

  memoryCache.set(key, envelope);
}

export async function getOrSetCache<T extends CacheableData = CacheableData>(
  key: string,
  factory: () => Promise<T>,
  options: SetCacheOptions = {},
): Promise<T> {
  const existing = await getCache<T>(key);

  if (existing !== null) {
    return existing;
  }

  const value = await factory();
  await setCache(key, value, options);
  return value;
}

export async function deleteCache(key: string): Promise<void> {
  if (redis) {
    await redis.del(key);
    return;
  }

  memoryCache.delete(key);
}

export async function appendHistory<T extends CacheableData = CacheableData>(
  entry: Omit<HistoryEntry<T>, "id" | "createdAt"> &
    Partial<Pick<HistoryEntry<T>, "id" | "createdAt">>,
  options: AppendHistoryOptions = {},
): Promise<HistoryEntry<T>> {
  const historyKey = getSessionHistoryKey(options.sessionId);
  const maxEntries = options.maxEntries ?? DEFAULT_HISTORY_LIMIT;

  const normalized: HistoryEntry<T> = {
    ...entry,
    id: entry.id ?? createHistoryId("history"),
    createdAt: entry.createdAt ?? new Date().toISOString(),
    payload: clone(entry.payload),
    tags: entry.tags ? [...entry.tags] : [],
  };

  if (redis) {
    await redis.lpush(historyKey, JSON.stringify(normalized));
    await redis.ltrim(historyKey, 0, maxEntries - 1);
    return normalized;
  }

  const existing = memoryHistory.get(historyKey) ?? [];
  const next = [normalized, ...existing].slice(0, maxEntries);
  memoryHistory.set(historyKey, next);
  return normalized;
}

export async function getHistory(sessionId?: string): Promise<HistoryEntry[]> {
  const historyKey = getSessionHistoryKey(sessionId);

  if (redis) {
    const items = await redis.lrange(historyKey, 0, -1);

    return (items ?? [])
      .map((item) => {
        try {
          return JSON.parse(item) as HistoryEntry;
        } catch {
          return null;
        }
      })
      .filter((item): item is HistoryEntry => item !== null);
  }

  return clone(memoryHistory.get(historyKey) ?? []);
}

export async function clearHistory(sessionId?: string): Promise<void> {
  const historyKey = getSessionHistoryKey(sessionId);

  if (redis) {
    await redis.del(historyKey);
    return;
  }

  memoryHistory.delete(historyKey);
}

export function isRedisConfigured() {
  return hasRedisEnv();
}

export function getCacheTtlSeconds() {
  return DEFAULT_CACHE_TTL_SECONDS;
}
