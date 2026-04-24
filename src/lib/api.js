import { auth } from "./firebase.js";

const DEFAULT_API_TIMEOUT_MS = 15000;

export class ApiRequestError extends Error {
  constructor(message, { status = null, payload = null } = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }
}

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
}

function createRequestController(signal, timeoutMs) {
  const controller = new AbortController();
  let timeoutId = null;
  let timedOut = false;

  const abortFromParent = () => {
    if (!controller.signal.aborted) {
      controller.abort(signal?.reason ?? new DOMException("Request aborted.", "AbortError"));
    }
  };

  if (signal) {
    if (signal.aborted) {
      abortFromParent();
    } else {
      signal.addEventListener("abort", abortFromParent, { once: true });
    }
  }

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      if (!controller.signal.aborted) {
        controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms.`, "AbortError"));
      }
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup() {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
      if (signal) {
        signal.removeEventListener("abort", abortFromParent);
      }
    },
  };
}

export async function apiFetch(path, options = {}) {
  const {
    headers: incomingHeaders,
    signal: incomingSignal,
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
    body,
    ...fetchOptions
  } = options;
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("API base URL is not configured.");
  }

  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(incomingHeaders || {});

  const user = auth?.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const normalizedBody =
    body == null || typeof body === "string" || isFormData ? body : JSON.stringify(body);

  if (normalizedBody != null && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const requestController = createRequestController(incomingSignal, timeoutMs);

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      body: normalizedBody,
      signal: requestController.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const err = json?.error || (text && !text.startsWith("<") ? text : null) || `Server error (${res.status}). Please try again.`;
      throw new ApiRequestError(err, {
        status: res.status,
        payload: json,
      });
    }
    return json;
  } catch (error) {
    if (requestController.didTimeout()) {
      throw new Error(`Request timed out after ${timeoutMs}ms.`);
    }
    if (error?.name === "AbortError") {
      throw error;
    }
    if (error instanceof ApiRequestError) {
      throw error;
    }
    throw error instanceof Error ? error : new Error("Network request failed.");
  } finally {
    requestController.cleanup();
  }
}
