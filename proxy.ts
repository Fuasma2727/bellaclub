import { NextResponse, type NextRequest } from "next/server";
import {
  adminIpEnvKeys,
  hasIpAllowList,
  isIpAllowed,
  siteIpEnvKeys,
} from "./lib/ipAccess";

const CANONICAL_HOST = "belaclub.co";
const protectedAdminPrefixes = ["/admin", "/api/admin"];
const siteLockdownExceptions = [
  "/api/wompi/webhook",
  "/api/wompi/payouts-webhook",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
];

const isFileRequest = (pathname: string) => /\.[a-z0-9]+$/i.test(pathname);

const privateNotFound = () =>
  new NextResponse("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store, no-cache, max-age=0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });

const normalizeHost = (value: string) =>
  value
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasDotfileSegment = pathname
    .split("/")
    .some((segment) => segment.startsWith(".") && segment.length > 1);

  if (hasDotfileSegment) {
    return privateNotFound();
  }

  const isProtectedAdminRoute = protectedAdminPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedAdminRoute && !isIpAllowed(request, adminIpEnvKeys)) {
    return privateNotFound();
  }

  const siteLockdownEnabled = hasIpAllowList(siteIpEnvKeys);
  const isSiteLockdownException =
    isFileRequest(pathname) ||
    siteLockdownExceptions.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

  if (
    siteLockdownEnabled &&
    !isSiteLockdownException &&
    !isIpAllowed(request, siteIpEnvKeys)
  ) {
    return privateNotFound();
  }

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

  if (isBelaClubHost && (host !== CANONICAL_HOST || protocol !== "https")) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.host = CANONICAL_HOST;
    canonicalUrl.port = "";

    return NextResponse.redirect(canonicalUrl, 308);
  }

  const isProfileRoute = /^\/escorts\/[^/]+\/[^/]+--[^/]+$/.test(pathname);
  const isPhoneRoute = /^\/telefono\/[^/]+$/.test(pathname);
  if (isProfileRoute || isPhoneRoute) {
    let redirectPath: string | null;
    try {
      const { getPublicProfileRedirectPath, getPublicPhoneRedirectPath } = await import(
        "./lib/publicProfileRoute"
      );
      redirectPath = await (isPhoneRoute
        ? getPublicPhoneRedirectPath(pathname)
        : getPublicProfileRedirectPath(pathname));
    } catch (error) {
      console.error("Public profile route temporarily unavailable:", error);
      return new NextResponse(
        "No pudimos cargar este perfil. Intenta de nuevo en unos minutos.",
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": "60",
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    }

    if (redirectPath) {
      // Run before the page/ISR cache: cached render headers must never
      // remove or duplicate the HTTP redirect's Location.
      const destination = request.nextUrl.clone();
      destination.pathname = redirectPath;
      if (isBelaClubHost) {
        destination.protocol = "https:";
        destination.host = CANONICAL_HOST;
        destination.port = "";
      }
      return NextResponse.redirect(destination, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
