import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";

type AdminUserListItem = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  createdAt?: string | null;
  isOwner?: boolean;
};

const toDateString = (value: FirebaseFirestore.Timestamp | undefined) => {
  return value?.toDate?.().toISOString() ?? null;
};

export async function GET(request: Request) {
  try {
    const owner = await requireOwner(request);
    const searchParams = new URL(request.url).searchParams;
    const query = searchParams.get("q")?.trim().toLowerCase() || "";

    if (!query) {
      return NextResponse.json({ users: [] });
    }

    const snapshot = await adminDb.collection("users").get();

    const users: AdminUserListItem[] = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const email = typeof data.email === "string" ? data.email : "";
        const name = typeof data.name === "string" ? data.name.trim() : "";
        const role = typeof data.role === "string" ? data.role : "";
        const isOwner =
          doc.id === owner.uid ||
          Boolean(owner.email && email.toLowerCase() === owner.email.toLowerCase());

        return {
          id: doc.id,
          name: name || email || "Usuario sin nombre",
          email,
          role,
          createdAt: toDateString(data.createdAt),
          isOwner,
        };
      })
      .filter((item) => {
        const haystack = [item.name, item.email, item.role, item.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) => {
        if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;

        return String(b.createdAt || "").localeCompare(
          String(a.createdAt || "")
        );
      });

    return NextResponse.json({ users });
  } catch (error) {
    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}
