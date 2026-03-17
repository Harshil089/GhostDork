import { NextRequest } from "next/server";
import { createHash } from "node:crypto";

import {
  apiBadRequest,
  apiPayloadTooLarge,
  apiSuccess,
  apiServerError,
  apiUnauthorized,
  parseJsonBodyWithLimit,
  RequestBodyParseError,
  RequestBodyTooLargeError,
} from "@/lib/api/http";
import { appendHistory, getCacheTtlSeconds, getHistory } from "@/lib/cache";
import type { HistoryResponse, SessionHistoryItem } from "@/lib/types/osint";

import { z } from "zod";

const MAX_HISTORY_PAYLOAD_BYTES = 64 * 1024;
const MAX_HISTORY_REQUEST_BYTES = 256 * 1024;
const ACTOR_HEADER_NAME = "x-ghostdork-actor";
const ACTOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const historyKindSchema = z.enum([
  "structured-query",
  "batch-discovery",
  "image-analysis",
  "target-sweep",
]);

const sessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/)
  .optional();

const historyPayloadSchema = z.object({
  sessionId: sessionIdSchema,
  kind: historyKindSchema,
  title: z.string().trim().min(1).max(120),
  query: z.string().trim().min(1).max(1000),
  payload: z.record(z.string(), z.unknown()),
  target: z.string().trim().max(512).optional(),
  extensions: z.array(z.string().trim().min(1).max(32)).max(30).optional(),
});

function getActorScopeKey(request: NextRequest): string | null {
  const actorHeader = request.headers.get(ACTOR_HEADER_NAME)?.trim();
  if (actorHeader && ACTOR_ID_PATTERN.test(actorHeader)) {
    return actorHeader;
  }

  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader) {
    return null;
  }

  return createHash("sha256").update(authHeader).digest("hex").slice(0, 24);
}

function resolveScopedSessionId(request: NextRequest, sessionId?: string): string {
  const actor = getActorScopeKey(request);
  if (!actor) {
    throw new Error("AUTH_REQUIRED");
  }
  const normalizedSession = sessionId?.trim() || "default";
  return `${actor}:${normalizedSession}`;
}

function payloadBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value ?? {}), "utf-8");
}

function toSessionHistoryItem(item: {
  id: string;
  title: string;
  type: SessionHistoryItem["kind"] | "export";
  query: string;
  target?: string;
  createdAt: string;
  payload: unknown;
}): SessionHistoryItem | null {
  if (item.type === "export") {
    return null;
  }

  return {
    id: item.id,
    label: item.title,
    kind: item.type,
    input:
      item.payload && typeof item.payload === "object"
        ? (item.payload as Record<string, unknown>)
        : { query: item.query, target: item.target },
    summary: item.query || item.target,
    createdAt: item.createdAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    const parsedSession = sessionIdSchema.safeParse(
      request.nextUrl.searchParams.get("sessionId") ?? undefined,
    );

    if (!parsedSession.success) {
      return apiBadRequest("Invalid input", "Invalid sessionId format");
    }

    let scopedSessionId: string;
    try {
      scopedSessionId = resolveScopedSessionId(request, parsedSession.data);
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") {
        return apiUnauthorized("Authentication required", "Missing authorization header");
      }
      throw error;
    }
    const items = await getHistory(scopedSessionId);

    const response: HistoryResponse = {
      items: items
        .map(toSessionHistoryItem)
        .filter((item): item is SessionHistoryItem => item !== null),
    };

    return apiSuccess(response);
  } catch (error) {
    console.error("Failed to fetch session history.", error);
    return apiServerError("Failed to fetch session history.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await parseJsonBodyWithLimit(request, MAX_HISTORY_REQUEST_BYTES);
    const parsed = historyPayloadSchema.safeParse(json);

    if (!parsed.success) {
      return apiBadRequest("Invalid input", "Request body is incorrectly formatted");
    }

    const data = parsed.data;

    if (payloadBytes(data.payload) > MAX_HISTORY_PAYLOAD_BYTES) {
      return apiBadRequest(
        "Invalid input",
        `Payload exceeds ${MAX_HISTORY_PAYLOAD_BYTES} bytes`,
      );
    }

    let scopedSessionId: string;
    try {
      scopedSessionId = resolveScopedSessionId(request, data.sessionId);
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") {
        return apiUnauthorized("Authentication required", "Missing authorization header");
      }
      throw error;
    }

    await appendHistory(
      {
        type: data.kind,
        title: data.title,
        query: data.query,
        target: data.target,
        tags: data.extensions,
        ttlSeconds: getCacheTtlSeconds(),
        payload: data.payload,
      },
      { sessionId: scopedSessionId },
    );

    return apiSuccess({ success: true });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return apiPayloadTooLarge(
        "Payload too large.",
        `Request body exceeds ${MAX_HISTORY_REQUEST_BYTES} bytes.`,
      );
    }

    if (error instanceof RequestBodyParseError) {
      return apiBadRequest("Invalid JSON body.", error.message);
    }

    console.error("Failed to save history.", error);
    return apiServerError(
      "Failed to save history.",
    );
  }
}
