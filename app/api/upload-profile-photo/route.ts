import { NextResponse } from "next/server";

export const runtime = "nodejs"; // 👈 CLAVE

const BUNNY_STORAGE_NAME = "pp-profile-photos";
const BUNNY_API_KEY = process.env.BUNNY_API_KEY!;
const BUNNY_API_URL = `https://ny.storage.bunnycdn.com/${BUNNY_STORAGE_NAME}`;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

    const upload = await fetch(`${BUNNY_API_URL}/${filename}`, {
      method: "PUT",
      headers: {
        AccessKey: BUNNY_API_KEY,
        "Content-Type": file.type || "application/octet-stream",
        "Content-Length": buffer.length.toString(),
      },
      body: buffer,
    });

    if (!upload.ok) {
      const errorText = await upload.text();
      console.error("Bunny upload error:", upload.status, errorText);

      return NextResponse.json(
        { error: "Upload failed", details: errorText },
        { status: 500 }
      );
    }

    const publicUrl = `https://pp-profile-photos-cdn.b-cdn.net/${filename}`;

    return NextResponse.json({ url: publicUrl });
  } catch (err: any) {
    console.error("Upload error:", err);

    return NextResponse.json(
      { error: "Unexpected error", details: String(err) },
      { status: 500 }
    );
  }
}
