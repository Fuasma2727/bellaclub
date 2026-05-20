import { NextResponse } from "next/server";
import { creditApprovedRecharge } from "@/lib/wompiRecharge";

export const runtime = "nodejs";

const PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY;

export async function GET(request: Request) {
  try {
    if (!PUBLIC_KEY) {
      return NextResponse.json(
        { error: "Wompi no esta configurado" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Transaccion requerida" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://production.wompi.co/v1/transactions/${id}`,
      {
        headers: {
          Authorization: `Bearer ${PUBLIC_KEY}`,
        },
        cache: "no-store",
      }
    );
    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: "No pudimos consultar la transaccion" },
        { status: response.status }
      );
    }

    const transaction = payload.data;
    const creditResult = await creditApprovedRecharge(transaction);

    return NextResponse.json({
      status: transaction.status,
      amountInCents: transaction.amount_in_cents,
      credited: creditResult.credited,
      reason: creditResult.reason || null,
    });
  } catch (error) {
    console.error("Error confirmando Wompi:", error);
    return NextResponse.json(
      { error: "Error confirmando el pago" },
      { status: 500 }
    );
  }
}
