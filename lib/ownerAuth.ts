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

const getErrorDetails = (error: unknown) => {
  if (!(error instanceof Error)) {
    return "";
  }

  const typedError = error as Error & {
    code?: unknown;
    details?: unknown;
    errorInfo?: { code?: unknown; message?: unknown };
  };

  return [
    typedError.code,
    typedError.details,
    typedError.message,
    typedError.errorInfo?.code,
    typedError.errorInfo?.message,
  ]
    .filter(Boolean)
    .join(" ");
};

const isFirebaseAdminCredentialError = (error: unknown) => {
  const details = getErrorDetails(error).toLowerCase();

  return (
    details.includes("app/invalid-credential") ||
    details.includes("invalid credential") ||
    details.includes("invalid-credential") ||
    details.includes("credential implementation") ||
    details.includes("valid google oauth2 access token")
  );
};

const verifyOwnerToken = async (token: string) => {
  try {
    return await adminAuth.verifyIdToken(token, true);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Owner token verification failed:",
        getErrorDetails(error) || error
      );
    }

    if (isFirebaseAdminCredentialError(error)) {
      throw new Error("ADMIN_AUTH_INVALID_CREDENTIAL");
    }

    throw new Error("INVALID_TOKEN");
  }
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

  const decoded = await verifyOwnerToken(token);
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

  const typedError = error as Error & { code?: unknown };
  const details = getErrorDetails(error);

  if (error.message === "OWNER_NOT_CONFIGURED") {
    return {
      message: "Configura OWNER_EMAIL u OWNER_UID en .env.local",
      status: 500,
    };
  }

  if (error.message === "MISSING_TOKEN") {
    return { message: "Debes iniciar sesión", status: 401 };
  }

  if (error.message === "INVALID_TOKEN") {
    return {
      message:
        "Tu sesión venció o no es válida. Cierra sesión e inicia de nuevo.",
      status: 401,
    };
  }

  if (error.message === "ADMIN_AUTH_INVALID_CREDENTIAL") {
    return {
      message:
        "La credencial de Firebase Admin en .env.local no es válida. Regenera la clave de servicio.",
      status: 500,
    };
  }

  if (isFirebaseAdminCredentialError(error)) {
    return {
      message:
        "La credencial de Firebase Admin en .env.local no es válida. Regenera la clave de servicio.",
      status: 500,
    };
  }

  if (error.message === "FORBIDDEN") {
    return { message: "No tienes acceso a este panel", status: 403 };
  }

  if (typedError.code === 8 || details.includes("Quota exceeded")) {
    return {
      message:
        "Firestore esta sin cuota temporalmente. Intenta de nuevo cuando se libere la cuota.",
      status: 503,
    };
  }

  return {
    message: "No pudimos cargar el panel de administrador",
    status: 500,
  };
};
