import { NextResponse } from "next/server";

import type { ApiErrorResponse } from "@/lib/types/osint";

export type ApiSuccessInit = {
  status?: number;
  headers?: HeadersInit;
};

export type ApiErrorInit = {
  status?: number;
  details?: string;
  headers?: HeadersInit;
};

export type PaginatedMeta = {
  total: number;
  page: number;
  pageSize: number;
};

export function apiSuccess<T>(
  data: T,
  init: ApiSuccessInit = {},
) {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

export function apiCreated<T>(
  data: T,
  init: Omit<ApiSuccessInit, "status"> = {},
) {
  return apiSuccess(data, {
    ...init,
    status: 201,
  });
}

export function apiAccepted<T>(
  data: T,
  init: Omit<ApiSuccessInit, "status"> = {},
) {
  return apiSuccess(data, {
    ...init,
    status: 202,
  });
}

export function apiNoContent(init: Omit<ApiSuccessInit, "status"> = {}) {
  return new NextResponse(null, {
    status: 204,
    headers: init.headers,
  });
}

export function apiError(
  error: string,
  init: ApiErrorInit = {},
) {
  const body: ApiErrorResponse = {
    error,
    ...(init.details ? { details: init.details } : {}),
    statusCode: init.status ?? 500,
  };

  return NextResponse.json(body, {
    status: init.status ?? 500,
    headers: init.headers,
  });
}

export function apiBadRequest(
  error = "Bad request.",
  details?: string,
  headers?: HeadersInit,
) {
  return apiError(error, {
    status: 400,
    details,
    headers,
  });
}

export function apiUnauthorized(
  error = "Unauthorized.",
  details?: string,
  headers?: HeadersInit,
) {
  return apiError(error, {
    status: 401,
    details,
    headers,
  });
}

export function apiForbidden(
  error = "Forbidden.",
  details?: string,
  headers?: HeadersInit,
) {
  return apiError(error, {
    status: 403,
    details,
    headers,
  });
}

export function apiNotFound(
  error = "Not found.",
  details?: string,
  headers?: HeadersInit,
) {
  return apiError(error, {
    status: 404,
    details,
    headers,
  });
}

export function apiConflict(
  error = "Conflict.",
  details?: string,
  headers?: HeadersInit,
) {
  return apiError(error, {
    status: 409,
    details,
    headers,
  });
}

export function apiUnprocessableEntity(
  error = "Validation failed.",
  details?: string,
  headers?: HeadersInit,
) {
  return apiError(error, {
    status: 422,
    details,
    headers,
  });
}

export function apiTooManyRequests(
  error = "Too many requests.",
  details?: string,
  headers?: HeadersInit,
) {
  return apiError(error, {
    status: 429,
    details,
    headers,
  });
}

export function apiServerError(
  error = "Internal server error.",
  details?: string,
  headers?: HeadersInit,
) {
  return apiError(error, {
    status: 500,
    details,
    headers,
  });
}

export function apiUnavailable(
  error = "Service unavailable.",
  details?: string,
  headers?: HeadersInit,
) {
  return apiError(error, {
    status: 503,
    details,
    headers,
  });
}

export function withPagination<T>(
  items: T[],
  meta: PaginatedMeta,
) {
  return {
    items,
    pagination: {
      total: meta.total,
      page: meta.page,
      pageSize: meta.pageSize,
      totalPages:
        meta.pageSize > 0 ? Math.ceil(meta.total / meta.pageSize) : 0,
      hasNextPage: meta.page * meta.pageSize < meta.total,
      hasPreviousPage: meta.page > 1,
    },
  };
}

export function apiPaginated<T>(
  items: T[],
  meta: PaginatedMeta,
  init: ApiSuccessInit = {},
) {
  return apiSuccess(withPagination(items, meta), init);
}

export async function fromRouteHandler<T>(
  handler: () => Promise<T>,
) {
  try {
    const data = await handler();
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error) {
      return apiServerError(error.message);
    }

    return apiServerError("An unknown error occurred.");
  }
}
