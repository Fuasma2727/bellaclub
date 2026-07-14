import { adminAuth } from "@/lib/firebaseAdmin";

export type OwnerUser = {
  uid: string;
  email?: string;
};

const getOwnerConfig = () => {
  const ownerUid = process.env.OWNER_UID?.trim();
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();

  return { ownerUid, ownerEmail };
};

export const requireOwner = async (request: Request): Promise<OwnerUser> => {
  const { ownerUid, ownerEmail } = getOwnerConfig();

  if (!ownerUid && !ownerEmail) {
    throw new Error("OWNER_NOT_CONFIGURED");
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    throw new Error("MISSING_TOKEN");
  }

  const decoded = await adminAuth.verifyIdToken(token, true);
  const decodedEmail = decoded.email?.toLowerCase();

  const matchesUid = ownerUid ? decoded.uid === ownerUid : false;
  const matchesEmail = ownerEmail
    ? decodedEmail === ownerEmail && decoded.email_verified === true
    : false;

  if (!matchesUid && !matchesEmail) {
    throw new Error("FORBIDDEN");
  }

  return {
    uid: decoded.uid,
    email: decoded.email,
  };
};

export const ownerAuthError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return { message: "No autorizado", status: 401 };
  }

  if (error.message === "OWNER_NOT_CONFIGURED") {
    return {
      message: "Configura OWNER_EMAIL u OWNER_UID en .env.local",
      status: 500,
    };
  }

  if (error.message === "MISSING_TOKEN") {
    return { message: "Debes iniciar sesión", status: 401 };
  }

  return { message: "No tienes acceso a este panel", status: 403 };
};
