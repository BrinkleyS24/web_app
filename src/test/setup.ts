import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement IntersectionObserver, which framer-motion's useInView
// (used by scroll-reveals / count-ups) requires. This no-op stub never reports
// intersection, so view-triggered animations stay at their initial real values
// in tests instead of throwing.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
// @ts-expect-error assigning a minimal stub onto the global
globalThis.IntersectionObserver = IntersectionObserverStub;

// Some components read prefers-reduced-motion via matchMedia.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  // @ts-expect-error minimal matchMedia stub for jsdom
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
