import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
};

export const requireAuthenticatedUser = async (request: Request) => {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("MISSING_TOKEN");
  }

  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    throw new Error("INVALID_TOKEN");
  }
};

export const requireUserDocument = async (uid: string) => {
  const userRef = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    ref: userRef,
    data: userSnap.data() || {},
  };
};

export const authRouteError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return { message: "No autorizado", status: 401 };
  }

  if (error.message === "MISSING_TOKEN") {
    return { message: "Debes iniciar sesion", status: 401 };
  }

  if (error.message === "INVALID_TOKEN") {
    return { message: "Token de sesion invalido", status: 401 };
  }

  if (error.message === "USER_NOT_FOUND") {
    return { message: "Usuario no encontrado", status: 404 };
  }

  return { message: "No autorizado", status: 401 };
};
