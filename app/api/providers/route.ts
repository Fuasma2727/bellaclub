import { NextResponse } from "next/server";
import {
  getPublicProviderCards,
  PublicProvidersUnavailableError,
} from "@/lib/publicProviders";

export async function GET() {
  try {
    const providers = await getPublicProviderCards({ requireAvailable: true });

    return NextResponse.json(
      { providers },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("Error loading providers:", error);
    const unavailable = error instanceof PublicProvidersUnavailableError;

    return NextResponse.json(
      { error: "No pudimos cargar los perfiles" },
      {
        status: unavailable ? 503 : 500,
        headers: {
          "Cache-Control": "no-store",
          ...(unavailable ? { "Retry-After": "5" } : {}),
        },
      }
    );
  }
}
