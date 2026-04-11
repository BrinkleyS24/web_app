import { signInWithCustomToken } from "firebase/auth";
import { auth, firebaseConfigured } from "./firebase.js";

const BRIDGE_REQUEST = "APPLENDIUM_EXTENSION_TOKEN_REQUEST";
const BRIDGE_RESPONSE = "APPLENDIUM_EXTENSION_TOKEN_RESPONSE";
const LOGOUT_REQUEST = "APPLENDIUM_EXTENSION_LOGOUT_REQUEST";
const LOGOUT_RESPONSE = "APPLENDIUM_EXTENSION_LOGOUT_RESPONSE";
const BRIDGE_TIMEOUT_MS = 6000;

function requestBridge(messageType, responseType) {
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
      if (data.type !== responseType || data.nonce !== nonce) return;
      cleanup();
      resolve(data);
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ type: messageType, nonce }, window.location.origin);
  });
}

export async function signInFromExtensionBridge() {
  if (!firebaseConfigured || !auth) {
    return { success: false, error: "Firebase is not configured." };
  }

  console.log("[Applendium Bridge] Requesting extension-backed web auth...");
  const tokenResponse = await requestBridge(BRIDGE_REQUEST, BRIDGE_RESPONSE);
  if (!tokenResponse?.success || !tokenResponse?.firebaseToken) {
    console.log("[Applendium Bridge] Token request failed:", tokenResponse?.error);
    return { success: false, error: tokenResponse?.error || "No extension token available." };
  }

  console.log("[Applendium Bridge] Signing in with custom token...");
  await signInWithCustomToken(auth, tokenResponse.firebaseToken);
  console.log("[Applendium Bridge] Sign-in complete!");
  return { success: true };
}

export async function signOutFromExtensionBridge() {
  console.log("[Applendium Bridge] Requesting extension logout...");
  const logoutResponse = await requestBridge(LOGOUT_REQUEST, LOGOUT_RESPONSE);
  if (!logoutResponse?.success) {
    console.log("[Applendium Bridge] Logout request failed:", logoutResponse?.error);
    return { success: false, error: logoutResponse?.error || "Extension logout failed." };
  }

  console.log("[Applendium Bridge] Extension logout complete.");
  return { success: true };
}

