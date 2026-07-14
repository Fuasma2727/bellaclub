import crypto from "crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { assertBodySize, securityErrorResponse } from "@/lib/requestSecurity";
import { creditApprovedRecharge } from "@/lib/wompiRecharge";

export const runtime = "nodejs";

const EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET;

type WompiEvent = {
  event?: string;
  data?: Record<string, unknown>;
  signature?: {
    properties?: string[];
    checksum?: string;
  };
  timestamp?: number | string;
};

type WompiTransaction = {
  id: string;
  reference: string;
  status: "APPROVED" | "DECLINED" | "ERROR" | "PENDING" | "VOIDED";
  amount_in_cents: number;
  currency: string;
};

const getPathValue = (source: unknown, path: string) => {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
};

const safeCompare = (left: string, right: string) => {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left.toLowerCase(), "hex");
  const rightBuffer = Buffer.from(right.toLowerCase(), "hex");

  if (leftBuffer.length !== rightBuffer.length) return false;

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const isValidWompiEvent = (event: WompiEvent, headerChecksum: string | null) => {
  if (!EVENTS_SECRET) return false;

  const properties = event.signature?.properties;
  const checksum = headerChecksum || event.signature?.checksum;

  if (!Array.isArray(properties) || !checksum || !event.timestamp) {
    return false;
  }

  const payload = properties
    .map((property) => {
      const cleanPath = property.startsWith("data.")
        ? property.slice("data.".length)
        : property;
      const value = getPathValue(event.data, cleanPath);
      return value === undefined || value === null ? "" : String(value);
    })
    .join("");

  const expected = crypto
    .createHash("sha256")
    .update(`${payload}${event.timestamp}${EVENTS_SECRET}`)
    .digest("hex");

  return safeCompare(expected, checksum);
};

const isWompiTransaction = (value: unknown): value is WompiTransaction => {
  if (!value || typeof value !== "object") return false;

  const transaction = value as Record<string, unknown>;

  return (
    typeof transaction.id === "string" &&
    typeof transaction.reference === "string" &&
    typeof transaction.status === "string" &&
    typeof transaction.amount_in_cents === "number" &&
    typeof transaction.currency === "string"
  );
};

export async function POST(request: Request) {
  try {
    assertBodySize(request, 64 * 1024);

    const event = (await request.json()) as WompiEvent;
    const headerChecksum = request.headers.get("x-event-checksum");

    if (!isValidWompiEvent(event, headerChecksum)) {
      return NextResponse.json(
        { error: "Firma de evento invalida" },
        { status: 401 }
      );
    }

    await adminDb.collection("wompiEvents").doc().set({
      event: event?.event || null,
      transactionId:
        typeof event?.data?.transaction === "object" &&
        event.data.transaction !== null &&
        "id" in event.data.transaction
          ? (event.data.transaction as Record<string, unknown>).id
          : null,
      reference:
        typeof event?.data?.transaction === "object" &&
        event.data.transaction !== null &&
        "reference" in event.data.transaction
          ? (event.data.transaction as Record<string, unknown>).reference
          : null,
      hasHeaderChecksum: Boolean(headerChecksum),
      receivedAt: new Date().toISOString(),
    });

    const transaction = event?.data?.transaction;

    if (event?.event !== "transaction.updated" || !isWompiTransaction(transaction)) {
      return NextResponse.json({ received: true });
    }

    const result = await creditApprovedRecharge(transaction);

    return NextResponse.json({ received: true, credited: result.credited });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    console.error("Error procesando webhook Wompi:", error);
    return NextResponse.json(
      { error: "Error procesando webhook" },
      { status: 500 }
    );
  }
}
