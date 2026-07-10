import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";

function readEnv(name) {
  const value = import.meta.env[name];
  return value ? String(value) : "";
}

export const firebaseConfigured = Boolean(
  readEnv("VITE_FIREBASE_API_KEY") &&
    readEnv("VITE_FIREBASE_AUTH_DOMAIN") &&
    readEnv("VITE_FIREBASE_PROJECT_ID") &&
    readEnv("VITE_FIREBASE_APP_ID")
);

let app = null;
export let auth = null;

if (firebaseConfigured) {
  const firebaseConfig = {
    apiKey: readEnv("VITE_FIREBASE_API_KEY"),
    authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
    appId: readEnv("VITE_FIREBASE_APP_ID"),
  };

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);

  // The companion app is extension-scoped; do not keep auth beyond the active browser session.
  await setPersistence(auth, browserSessionPersistence);
} else {
  // eslint-disable-next-line no-console
  console.warn(
    "[web] Firebase is not configured. Set VITE_FIREBASE_* vars in .env.local to enable sign-in."
  );
}

// DEV-only QA hook: lets automated QA sign in with a backend-minted custom
// token (mirrors the extension bridge). Never present in production builds.
if (import.meta.env.DEV && typeof window !== "undefined") {
  window.__qaSignInWithCustomToken = async (token) => {
    if (!auth) throw new Error("Firebase Auth is not configured.");
    return signInWithCustomToken(auth, token);
  };
}

export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase Auth is not configured.");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}
