import { NextResponse } from "next/server";
import { getPublicProviderCards } from "@/lib/publicProviders";

export async function GET() {
  try {
    const providers = await getPublicProviderCards();

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("Error loading providers:", error);
    return NextResponse.json(
      { error: "No pudimos cargar los perfiles" },
      { status: 500 }
    );
  }
}
