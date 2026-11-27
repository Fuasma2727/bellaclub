import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { app } from "./firebaseApp";

export { app };
export { auth } from "./firebaseAuth";

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
