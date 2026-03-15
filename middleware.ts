import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
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
  const [username, password] = decodedValue.split(":");

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
