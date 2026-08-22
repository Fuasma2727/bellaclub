import { initializeApp, getApp, getApps } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyAEK_BjfoRneAWOVS1VVpvLuDHR53aKxoM",
  authDomain: "pp-project-9c48b.firebaseapp.com",
  projectId: "pp-project-9c48b",
  storageBucket: "pp-project-9c48b.firebasestorage.app",
  messagingSenderId: "706378398078",
  appId: "1:706378398078:web:e8bb02ccfa4b2f4860db2f",
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
