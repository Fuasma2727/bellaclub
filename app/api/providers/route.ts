import { NextResponse } from "next/server";
import { getPublicProviderCards } from "@/lib/publicProviders";

export async function GET() {
  try {
    const providers = await getPublicProviderCards();

    return NextResponse.json(
      { providers },
      {
        headers: {
          "Cache-Control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error) {
    console.error("Error loading providers:", error);
    return NextResponse.json(
      { error: "No pudimos cargar los perfiles" },
      { status: 500 }
    );
  }
}
