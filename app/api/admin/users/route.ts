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

type CachedAdminUserListItem = Omit<AdminUserListItem, "isOwner">;

type AdminUsersCache = {
  users?: CachedAdminUserListItem[];
  expiresAt: number;
  inFlight?: Promise<CachedAdminUserListItem[]>;
};

const ADMIN_USERS_CACHE_TTL_MS = 2 * 60 * 1000;

const globalForAdminUsersCache = globalThis as typeof globalThis & {
  __belaclubAdminUsersCache?: AdminUsersCache;
};

const adminUsersCache = globalForAdminUsersCache.__belaclubAdminUsersCache || {
  expiresAt: 0,
};

globalForAdminUsersCache.__belaclubAdminUsersCache = adminUsersCache;

const toDateString = (value: FirebaseFirestore.Timestamp | undefined) => {
  return value?.toDate?.().toISOString() ?? null;
};

const loadAdminUsers = async () => {
  const snapshot = await adminDb
    .collection("users")
    .select("name", "email", "role", "createdAt")
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const email = typeof data.email === "string" ? data.email : "";
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const role = typeof data.role === "string" ? data.role : "";

    return {
      id: doc.id,
      name: name || email || "Usuario sin nombre",
      email,
      role,
      createdAt: toDateString(data.createdAt),
    };
  });
};

const getAdminUsers = async () => {
  const now = Date.now();

  if (adminUsersCache.users && adminUsersCache.expiresAt > now) {
    return adminUsersCache.users;
  }

  if (adminUsersCache.inFlight) {
    return adminUsersCache.inFlight;
  }

  adminUsersCache.inFlight = loadAdminUsers()
    .then((users) => {
      adminUsersCache.users = users;
      adminUsersCache.expiresAt = Date.now() + ADMIN_USERS_CACHE_TTL_MS;

      return users;
    })
    .catch((error) => {
      if (adminUsersCache.users) {
        adminUsersCache.expiresAt = Date.now() + 30 * 1000;
        console.error(
          "Error refreshing admin users; serving stale users:",
          error
        );

        return adminUsersCache.users;
      }

      throw error;
    })
    .finally(() => {
      adminUsersCache.inFlight = undefined;
    });

  return adminUsersCache.inFlight;
};

export async function GET(request: Request) {
  try {
    const owner = await requireOwner(request);
    const searchParams = new URL(request.url).searchParams;
    const query = searchParams.get("q")?.trim().toLowerCase() || "";

    if (!query) {
      return NextResponse.json({ users: [] });
    }

    const users: AdminUserListItem[] = (await getAdminUsers())
      .map((user) => {
        const isOwner =
          user.id === owner.uid ||
          Boolean(
            owner.email &&
              user.email?.toLowerCase() === owner.email.toLowerCase()
          );

        return {
          ...user,
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
