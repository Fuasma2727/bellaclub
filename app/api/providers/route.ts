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
            "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
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
