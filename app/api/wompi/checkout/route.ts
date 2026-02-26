import { NextResponse } from "next/server";
import crypto from "crypto";

// 🔐 Variables de entorno
const PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY!;
const INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET!;

// URL de checkout
const WOMPI_URL = "https://checkout.wompi.co/p/";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amountInCents, userId } = body;

    if (!amountInCents || !userId) {
      return NextResponse.json(
        { error: "Faltan datos requeridos" },
        { status: 400 }
      );
    }

    const currency = "COP";

    // 🔥 Referencia única
    const reference = `recarga_${userId}_${Date.now()}`;

    // =========================
    // 🔐 GENERAR FIRMA CORRECTA
    // =========================
    const stringToSign = `${reference}${amountInCents}${currency}${INTEGRITY_SECRET}`;

    const signature = crypto
      .createHash("sha256")
      .update(stringToSign)
      .digest("hex");

    // =========================
    // 🔗 URL FINAL CON FIRMA
    // =========================
const checkoutUrl = `https://checkout.wompi.co/p/?public-key=${PUBLIC_KEY}&currency=${currency}&amount-in-cents=${amountInCents}&reference=${reference}&signature=${signature}&redirect-url=http://localhost:3000/wompi/resultado`;
console.log(checkoutUrl);

    return NextResponse.json({ url: checkoutUrl });

  } catch (error) {
    console.error("Error generando checkout:", error);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}
