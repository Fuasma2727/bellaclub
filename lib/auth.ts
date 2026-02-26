import { app } from "./firebase";
import {
  getAuth,
  createUserWithEmailAndPassword,
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

// REGISTRO DE USUARIO + CREAR DOCUMENTO EN FIRESTORE CON ROLE
export const registerUser = async (
  email: string,
  password: string,
  role: string
) => {
  const credential: UserCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  const user = credential.user;
await setDoc(doc(db, "users", user.uid), {
  uid: user.uid,
  email: user.email,
  role: role,
  balance: 0,              // 👈 AQUI SE CREA EL BALANCE
  createdAt: serverTimestamp(),
});

  return user;
};

// LOGIN
export const loginUser = async (email: string, password: string) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

// LOGOUT
export const logoutUser = async () => {
  return await signOut(auth);
};
