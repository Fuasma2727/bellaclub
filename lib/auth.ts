import { app } from "./firebase";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  UserCredential,
} from "firebase/auth";

import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const auth = getAuth(app);
const db = getFirestore(app);

export type UserRole = "cliente" | "prestador";

export const registerUser = async (
  email: string,
  password: string,
  role: UserRole,
  verificationPhotoUrl?: string
) => {
  const credential: UserCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  const user = credential.user;
  const isProvider = role === "prestador";

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email,
    role,
    balance: 0,
    blocked: false,
    rating: 0,
    visitVerified: false,
    visitVerificationStatus: "none",
    verificationBadge: null,
    badgeVerificationStatus: "none",
    badgeVerificationLevel: null,
    isVerified: !isProvider,
    profileVisible: !isProvider,
    verificationStatus: isProvider ? "pending" : "approved",
    verificationPhotoUrl: isProvider ? verificationPhotoUrl ?? null : null,
    createdAt: serverTimestamp(),
  });

  return user;
};

export const loginUser = async (email: string, password: string) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const sendPasswordReset = async (email: string) => {
  return await sendPasswordResetEmail(auth, email);
};

export const logoutUser = async () => {
  return await signOut(auth);
};
