import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import Upgrade from "./Upgrade";

const useAuth = vi.fn();

vi.mock("../lib/AuthContext.jsx", () => ({
  useAuth: () => useAuth(),
}));

vi.mock("../lib/usePageMetadata.js", () => ({
  default: () => undefined,
}));

vi.mock("../lib/api.js", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("../lib/premiumLaunchContent.js", () => ({
  premiumUpdatesHref: "mailto:support@example.test",
  premiumFeatureCards: [],
  upgradeStatusCards: [],
}));

vi.mock("../components/PublicSiteLayout.jsx", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function renderPage(initialEntry = "/upgrade") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/upgrade" element={<Upgrade />} />
        <Route path="/dashboard" element={<div>Dashboard Route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Upgrade", () => {
  test("redirects signed-in premium users to the dashboard", async () => {
    useAuth.mockReturnValue({
      user: { email: "brinkleystacey12@gmail.com" },
      loading: false,
      plan: "premium",
      planLoading: false,
    });

    renderPage();

    expect(await screen.findByText("Dashboard Route")).toBeInTheDocument();
  });

  test("renders the premium beta checkout page for non-premium sessions", async () => {
    useAuth.mockReturnValue({
      user: { email: "free@example.test" },
      loading: false,
      plan: "free",
      planLoading: false,
    });

    renderPage();

    expect(await screen.findByText("Apply smarter before you spend another hour applying.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Start Premium Beta" })[0]).toBeInTheDocument();
    expect(screen.getByText("free@example.test")).toBeInTheDocument();
  });
});
