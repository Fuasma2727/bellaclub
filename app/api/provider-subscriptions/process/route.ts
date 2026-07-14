import { NextResponse } from "next/server";
import { processDueProviderSubscriptions } from "@/lib/providerSubscription";

export const runtime = "nodejs";

const isAuthorizedCron = (request: Request) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");

  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  return process.env.NODE_ENV !== "production" || vercelCron === "1";
};

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const summary = await processDueProviderSubscriptions();
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("PROVIDER SUBSCRIPTIONS CRON ERROR:", error);
    return NextResponse.json(
      { error: "No pudimos procesar mensualidades" },
      { status: 500 }
    );
  }
}
