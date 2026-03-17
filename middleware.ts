import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

type FallbackRateState = {
  timestamps: number[];
};

const fallbackRateStore = new Map<string, FallbackRateState>();

// Only initialize Ratelimit if Redis env vars are present
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_REQUESTS, "1 m"),
      analytics: true,
    })
  : null;

function getClientIdentity(req: NextRequest): string {
  const directIp = (req as NextRequest & { ip?: string }).ip?.trim();
  if (directIp) {
    return directIp;
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded
      .split(",")
      .map((part) => part.trim())
      .find(Boolean);

    if (first) {
      return first;
    }
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function applyFallbackRateLimit(identity: string) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const key = `ratelimit_${identity}`;

  const existing = fallbackRateStore.get(key) ?? { timestamps: [] };
  const recent = existing.timestamps.filter((timestamp) => timestamp > windowStart);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    const reset = Math.ceil((recent[0] + RATE_LIMIT_WINDOW_MS) / 1000);
    return {
      success: false,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: 0,
      reset,
    };
  }

  recent.push(now);
  fallbackRateStore.set(key, { timestamps: recent });

  return {
    success: true,
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(RATE_LIMIT_MAX_REQUESTS - recent.length, 0),
    reset: Math.ceil((now + RATE_LIMIT_WINDOW_MS) / 1000),
  };
}

function isRateLimitedRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/api/search") ||
    pathname.startsWith("/api/target") ||
    pathname.startsWith("/api/image") ||
    pathname.startsWith("/api/history") ||
    pathname.startsWith("/api/export")
  );
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const authPassword = process.env.AUTH_PASSWORD;
  const isProduction = process.env.NODE_ENV === "production";

  // Fail closed if production auth configuration is missing.
  if (isProduction && !authPassword) {
    return NextResponse.json(
      {
        error: "Server Misconfigured",
        message: "AUTH_PASSWORD must be configured in production.",
      },
      { status: 503 },
    );
  }

  // Apply rate limiting to high-risk API routes with Redis primary + memory fallback.
  if (isRateLimitedRoute(pathname)) {
    const identity = getClientIdentity(req);
    const result = ratelimit
      ? await ratelimit.limit(`ratelimit_${identity}`)
      : applyFallbackRateLimit(identity);

    const { success, limit, reset, remaining } = result;

    if (!success) {
      return NextResponse.json(
        {
          error: "Too Many Requests",
          message: `Rate limit exceeded (${RATE_LIMIT_MAX_REQUESTS} requests per minute).`,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        },
      );
    }
  }

  // If no password is set in the environment, bypass authentication entirely
  if (!authPassword) {
    return NextResponse.next();
  }

  // Check the "authorization" header
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    // If there is no authorization header, prompt for Basic Auth
    return new NextResponse("Authentication Required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="GhostDork Secure Dashboard"',
      },
    });
  }

  // The header looks like: "Basic dXNlcm5hbWU6cGFzc3dvcmQ="
  const authValue = authHeader.split(" ")[1];

  if (!authValue) {
    return new NextResponse("Malformed Authorization header.", { status: 400 });
  }

  // Decode the base64 string
  const decodedValue = Buffer.from(authValue, "base64").toString("utf-8");

  // The decoded format should be "username:password"
  // Use indexOf to handle passwords that contain colons
  const colonIndex = decodedValue.indexOf(":");
  const password = colonIndex >= 0 ? decodedValue.slice(colonIndex + 1) : "";

  // Check if the provided password exactly matches our environment password
  if (password === authPassword) {
    return NextResponse.next();
  }

  // If the password doesn't match, return 401 Unauthorized
  return new NextResponse("Invalid credentials.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="GhostDork Secure Dashboard"',
    },
  });
}

// Ensure the middleware runs on all API routes and the main dashboard page.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
