import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { app } from "./firebaseApp";

export { app };

const globalForFirestore = globalThis as typeof globalThis & {
  __belaclubFirestore?: Firestore;
};

const createFirestore = () => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
};

export const db =
  globalForFirestore.__belaclubFirestore ||
  (globalForFirestore.__belaclubFirestore = createFirestore());
export const auth = getAuth(app);
