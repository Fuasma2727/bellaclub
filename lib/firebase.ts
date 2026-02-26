// Import Firebase core functions
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEK_BjfoRneAWOVS1VVpvLuDHR53aKxoM",
  authDomain: "pp-project-9c48b.firebaseapp.com",
  projectId: "pp-project-9c48b",
  storageBucket: "pp-project-9c48b.firebasestorage.app",
  messagingSenderId: "706378398078",
  appId: "1:706378398078:web:e8bb02ccfa4b2f4860db2f"
};

// Prevent re-initialization during hot reloads in Next.js
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export Firestore and Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
