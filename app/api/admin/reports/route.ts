import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";

type ReportStatus = "pending" | "reviewed";

const toDateString = (value: FirebaseFirestore.Timestamp | undefined) => {
  return value?.toDate?.().toISOString() ?? null;
};

export async function GET(request: Request) {
  try {
    await requireOwner(request);

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") || "pending") as ReportStatus;
    const query = searchParams.get("q")?.trim().toLowerCase() || "";
    const snapshot = await adminDb
      .collection("reports")
      .where("status", "==", status)
      .get();

    const reports = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const providerId = String(data.providerId || "");
        const providerSnap = providerId
          ? await adminDb.collection("users").doc(providerId).get()
          : null;
        const provider = providerSnap?.data() || {};

        return {
          id: doc.id,
          providerId,
          providerName: provider.name || provider.email || "Prestador sin nombre",
          providerEmail: provider.email || "",
          providerWhatsapp: provider.whatsapp || "",
          providerPhotoUrl: provider.photoUrl || provider.verificationPhotoUrl || "",
          providerBlocked: Boolean(provider.blocked),
          reporterId: data.reporterId || "",
          reporterEmail: data.reporterEmail || "",
          reason: data.reason || "Reporte general",
          status: data.status || "pending",
          createdAt: toDateString(data.createdAt),
          reviewedAt: toDateString(data.reviewedAt),
        };
      })
    );

    const filtered = reports
      .filter((report) => {
        if (!query) return true;

        const haystack = [
          report.providerName,
          report.providerEmail,
          report.providerWhatsapp,
          report.reporterEmail,
          report.reason,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );

    return NextResponse.json({ reports: filtered });
  } catch (error) {
    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const owner = await requireOwner(request);
    const { reportId, action } = (await request.json()) as {
      reportId?: string;
      action?: "markReviewed" | "reopen";
    };

    if (!reportId || !action) {
      return NextResponse.json(
        { error: "Datos incompletos" },
        { status: 400 }
      );
    }

    const reportRef = adminDb.collection("reports").doc(reportId);
    const reportSnap = await reportRef.get();

    if (!reportSnap.exists) {
      return NextResponse.json(
        { error: "Reporte no encontrado" },
        { status: 404 }
      );
    }

    await reportRef.update(
      action === "markReviewed"
        ? {
            status: "reviewed",
            reviewedAt: adminFieldValue.serverTimestamp(),
            reviewedBy: owner.uid,
          }
        : {
            status: "pending",
            reviewedAt: null,
            reviewedBy: null,
            reopenedAt: adminFieldValue.serverTimestamp(),
            reopenedBy: owner.uid,
          }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}
