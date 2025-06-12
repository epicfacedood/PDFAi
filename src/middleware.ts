import { NextRequest, NextResponse } from "next/server";

// Allowed IP addresses (add your IPs here)
const ALLOWED_IPS = [
  "127.0.0.1", // localhost
  "::1", // localhost IPv6
  "192.168.1.0/24", // local network range (adjust as needed)
  // Add your specific IPs here, e.g.:
  // '203.0.113.1',   // your office IP
  "118.200.240.101",
];

// Simple IP range check for CIDR notation
function isIPInRange(ip: string, range: string): boolean {
  if (!range.includes("/")) {
    return ip === range;
  }

  const [rangeIP, prefixLength] = range.split("/");
  const prefix = parseInt(prefixLength, 10);

  // Simple IPv4 CIDR check
  if (ip.includes(".") && rangeIP.includes(".")) {
    const ipParts = ip.split(".").map(Number);
    const rangeParts = rangeIP.split(".").map(Number);

    const ipNum =
      (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    const rangeNum =
      (rangeParts[0] << 24) +
      (rangeParts[1] << 16) +
      (rangeParts[2] << 8) +
      rangeParts[3];

    const mask = ~((1 << (32 - prefix)) - 1);
    return (ipNum & mask) === (rangeNum & mask);
  }

  return false;
}

function isIPAllowed(ip: string): boolean {
  return ALLOWED_IPS.some((allowedIP) => isIPInRange(ip, allowedIP));
}

export function middleware(request: NextRequest) {
  // Get client IP
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const clientIP = forwarded?.split(",")[0] || realIP || "127.0.0.1";

  console.log(`Access attempt from IP: ${clientIP}`);

  // Check IP whitelist
  if (!isIPAllowed(clientIP)) {
    console.log(`IP ${clientIP} not in whitelist`);
    return new NextResponse("Access denied: IP not authorized", {
      status: 403,
    });
  }

  // Skip auth check for login page and API routes
  if (
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  // Check for authentication cookie
  const authCookie = request.cookies.get("pdf-ai-auth");

  if (!authCookie || authCookie.value !== "authenticated") {
    // Redirect to login page
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

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
