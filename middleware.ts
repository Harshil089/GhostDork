import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      analytics: true,
    })
  : null;

export async function middleware(req: NextRequest) {
  // Apply rate limiting to search, target, and image API routes
  if (
    ratelimit &&
    (req.nextUrl.pathname.startsWith("/api/search") ||
      req.nextUrl.pathname.startsWith("/api/target") ||
      req.nextUrl.pathname.startsWith("/api/image"))
  ) {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success, limit, reset, remaining } = await ratelimit.limit(
      `ratelimit_${ip}`
    );

    if (!success) {
      return NextResponse.json(
        {
          error: "Too Many Requests",
          message: "Rate limit exceeded (20 requests per minute).",
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString()
          }
        }
      );
    }
  }

  const authPassword = process.env.AUTH_PASSWORD;

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
