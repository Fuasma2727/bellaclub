import { NextResponse, type NextRequest } from "next/server";

const CANONICAL_HOST = "belaclub.co";

const normalizeHost = (value: string) =>
  value
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");

export function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  const host = normalizeHost(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      ""
  );
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(":", "");
  const isBelaClubHost =
    host === CANONICAL_HOST || host === `www.${CANONICAL_HOST}`;

  if (!isBelaClubHost || (host === CANONICAL_HOST && protocol === "https")) {
    return NextResponse.next();
  }

  const canonicalUrl = request.nextUrl.clone();
  canonicalUrl.protocol = "https:";
  canonicalUrl.host = CANONICAL_HOST;

  return NextResponse.redirect(canonicalUrl, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
