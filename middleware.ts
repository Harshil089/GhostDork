import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000; // Clean up expired entries every minute
const RATE_LIMIT_ENTRY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hour TTL for entries
const ACTOR_COOKIE_NAME = "ghostdork_actor";
const ACTOR_HEADER_NAME = "x-ghostdork-actor";
const ACTOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FallbackRateState = {
  timestamps: number[];
  lastCleanup: number;
};

const fallbackRateStore = new Map<string, FallbackRateState>();
let lastGlobalCleanup = Date.now();

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

function isPrivateIp(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();

  // IPv6 loopback/link-local/unique-local/multicast
  if (normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("ff")) return true;

  // IPv4 private and special ranges
  const parts = normalized.split(".");
  if (parts.length !== 4) {
    // Non-IPv4 address we do not trust for identity if unknown.
    return true;
  }

  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }

  const [a, b] = nums;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const max = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;

  for (let i = 0; i < max; i += 1) {
    const av = i < aBytes.length ? aBytes[i] : 0;
    const bv = i < bBytes.length ? bBytes[i] : 0;
    diff |= av ^ bv;
  }

  return diff === 0;
}

function getClientIdentity(req: NextRequest): string {
  const actor = req.cookies.get(ACTOR_COOKIE_NAME)?.value?.trim();
  if (actor && ACTOR_ID_PATTERN.test(actor)) {
    return `actor:${actor}`;
  }

  // Prefer direct IP from NextRequest (most reliable)
  const directIp = (req as NextRequest & { ip?: string }).ip?.trim();
  if (directIp && !isPrivateIp(directIp)) {
    return directIp;
  }

  // Cloudflare IP (only from Cloudflare)
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp && !isPrivateIp(cfIp)) {
    return cfIp;
  }

  // X-Real-IP only if from known proxy and not private
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp && !isPrivateIp(realIp)) {
    return realIp;
  }

  return "unknown";
}

function cleanupExpiredEntries() {
  const now = Date.now();
  
  // Global cleanup every hour to prevent unbounded growth
  if (now - lastGlobalCleanup > RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    const keysToDelete: string[] = [];
    
    for (const [key, state] of fallbackRateStore.entries()) {
      // Remove entries with all timestamps outside TTL window
      const validTimestamps = state.timestamps.filter(
        (ts) => now - ts < RATE_LIMIT_ENTRY_TTL_MS
      );
      
      if (validTimestamps.length === 0) {
        keysToDelete.push(key);
      } else if (validTimestamps.length < state.timestamps.length) {
        // Update with cleaned timestamps
        fallbackRateStore.set(key, {
          timestamps: validTimestamps,
          lastCleanup: now,
        });
      }
    }
    
    keysToDelete.forEach((key) => fallbackRateStore.delete(key));
    lastGlobalCleanup = now;
  }
}

function applyFallbackRateLimit(identity: string) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const key = `ratelimit_${identity}`;

  // Periodic cleanup to prevent memory leaks
  cleanupExpiredEntries();

  const existing = fallbackRateStore.get(key) ?? { timestamps: [], lastCleanup: now };
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
  fallbackRateStore.set(key, { timestamps: recent, lastCleanup: now });

  return {
    success: true,
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(RATE_LIMIT_MAX_REQUESTS - recent.length, 0),
    reset: Math.ceil((now + RATE_LIMIT_WINDOW_MS) / 1000),
  };
}

function isRateLimitedRoute(pathname: string): boolean {
  // Apply rate limiting to all API routes for protection
  return pathname.startsWith("/api/");
}

function generateRequestId(): string {
  return crypto.randomUUID();
}

function setSecurityHeaders(response: NextResponse): void {
  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  
  // XSS Protection
  response.headers.set("X-XSS-Protection", "1; mode=block");
  
  // HSTS (Strict-Transport-Security)
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  
  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none';"
  );
  
  // Referrer Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions Policy (formerly Feature Policy)
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
  );
}

function setCorsHeaders(response: NextResponse, req: NextRequest): void {
  // Only allow requests from same origin in production
  const allowedOrigin = process.env.ALLOWED_ORIGINS || req.nextUrl.origin;
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "86400");
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const authPassword = process.env.AUTH_PASSWORD;
  const requestId = generateRequestId();

  // Fail closed if auth configuration is missing (both production and dev)
  if (!authPassword) {
    // Allow only static assets and public health checks without auth
    if (
      !pathname.startsWith("/_next/") &&
      !pathname.startsWith("/favicon") &&
      pathname !== "/health"
    ) {
      return NextResponse.json(
        {
          error: "Server Misconfigured",
          message: "AUTH_PASSWORD must be configured.",
        },
        { status: 503, headers: { "X-Request-ID": requestId } },
      );
    }
    
    // For allowed paths, still add security headers
    let response = NextResponse.next();
    response.headers.set("X-Request-ID", requestId);
    setSecurityHeaders(response);
    return response;
  }

  // Apply rate limiting to all API routes with Redis primary + memory fallback.
  if (isRateLimitedRoute(pathname)) {
    const identity = getClientIdentity(req);
    const result = ratelimit
      ? await ratelimit.limit(`ratelimit_${identity}`)
      : applyFallbackRateLimit(identity);

    const { success, limit, reset, remaining } = result;

    if (!success) {
      const response = NextResponse.json(
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
            "X-Request-ID": requestId,
          },
        },
      );
      setSecurityHeaders(response);
      return response;
    }
  }

  // Check the "authorization" header
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    // If there is no authorization header, prompt for Basic Auth
    const response = new NextResponse("Authentication Required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="GhostDork Secure Dashboard"',
        "X-Request-ID": requestId,
      },
    });
    setSecurityHeaders(response);
    return response;
  }

  // The header looks like: "Basic dXNlcm5hbWU6cGFzc3dvcmQ="
  const authValue = authHeader.split(" ")[1];

  if (!authValue) {
    const response = new NextResponse("Malformed Authorization header.", {
      status: 400,
      headers: { "X-Request-ID": requestId },
    });
    setSecurityHeaders(response);
    return response;
  }

  let decodedValue: string;
  try {
    // Decode the base64 string
    decodedValue = atob(authValue);
  } catch {
    const response = new NextResponse("Invalid Authorization header encoding.", {
      status: 400,
      headers: { "X-Request-ID": requestId },
    });
    setSecurityHeaders(response);
    return response;
  }

  // The decoded format should be "username:password"
  // Use indexOf to handle passwords that contain colons
  const colonIndex = decodedValue.indexOf(":");
  const password = colonIndex >= 0 ? decodedValue.slice(colonIndex + 1) : "";

  // Use constant-time comparison to prevent timing attacks
  const passwordMatches = constantTimeEqual(password, authPassword);

  if (passwordMatches) {
    const existingActor = req.cookies.get(ACTOR_COOKIE_NAME)?.value?.trim();
    const actorId =
      existingActor && ACTOR_ID_PATTERN.test(existingActor)
        ? existingActor
        : crypto.randomUUID();

    const headers = new Headers(req.headers);
    headers.set(ACTOR_HEADER_NAME, actorId);

    const response = NextResponse.next({
      request: {
        headers,
      },
    });

    if (!existingActor || !ACTOR_ID_PATTERN.test(existingActor)) {
      response.cookies.set(ACTOR_COOKIE_NAME, actorId, {
        httpOnly: true,
        secure: true, // Always require HTTPS for cookies
        sameSite: "strict", // Stricter CSRF protection
        path: "/",
        maxAge: 60 * 60 * 24, // 24 hours instead of 30 days
      });
    }

    response.headers.set("X-Request-ID", requestId);
    setSecurityHeaders(response);
    setCorsHeaders(response, req);
    return response;
  }

  // If the password doesn't match, return 401 Unauthorized
  const response = new NextResponse("Invalid credentials.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="GhostDork Secure Dashboard"',
      "X-Request-ID": requestId,
    },
  });
  setSecurityHeaders(response);
  return response;
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
