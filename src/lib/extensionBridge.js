import { signInWithCustomToken } from "firebase/auth";
import { auth, firebaseConfigured } from "./firebase.js";
import { getApiBaseUrl } from "./api.js";

const BRIDGE_REQUEST = "APPLENDIUM_EXTENSION_TOKEN_REQUEST";
const BRIDGE_RESPONSE = "APPLENDIUM_EXTENSION_TOKEN_RESPONSE";
const BRIDGE_TIMEOUT_MS = 6000;

function requestExtensionIdToken() {
  return new Promise((resolve, reject) => {
    const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve({ success: false, error: "Extension token request timed out." });
    }, BRIDGE_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
    }

    function onMessage(event) {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type !== BRIDGE_RESPONSE || data.nonce !== nonce) return;
      cleanup();
      resolve(data);
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ type: BRIDGE_REQUEST, nonce }, window.location.origin);
  });
}

export async function signInFromExtensionBridge() {
  if (!firebaseConfigured || !auth) {
    return { success: false, error: "Firebase is not configured." };
  }

  console.log("[Applendium Bridge] Requesting ID token from extension...");
  const tokenResponse = await requestExtensionIdToken();
  if (!tokenResponse?.success || !tokenResponse?.token) {
    console.log("[Applendium Bridge] Token request failed:", tokenResponse?.error);
    return { success: false, error: tokenResponse?.error || "No extension token available." };
  }

  console.log("[Applendium Bridge] Got token, exchanging with backend...");
  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/auth/extension-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenResponse.token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.firebaseToken) {
    console.log("[Applendium Bridge] Backend token exchange failed:", response.status, payload?.error);
    return { success: false, error: payload?.error || "Failed to exchange extension token." };
  }

  console.log("[Applendium Bridge] Signing in with custom token...");
  await signInWithCustomToken(auth, payload.firebaseToken);
  console.log("[Applendium Bridge] Sign-in complete!");
  return { success: true };
}

