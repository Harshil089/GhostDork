import { NextRequest } from "next/server";

import { apiSuccess, apiServerError } from "@/lib/api/http";
import { getHistory } from "@/lib/cache";
import type { HistoryResponse, SessionHistoryItem } from "@/lib/types/osint";

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
    const sessionId = request.nextUrl.searchParams.get("sessionId") ?? undefined;
    const items = await getHistory(sessionId);

    const response: HistoryResponse = {
      items: items
        .map(toSessionHistoryItem)
        .filter((item): item is SessionHistoryItem => item !== null),
    };

    return apiSuccess(response);
  } catch (error) {
    return apiServerError(
      "Failed to fetch session history.",
      error instanceof Error ? error.message : "Unknown error.",
    );
  }
}
