import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@/lib/AuthContext.jsx", () => ({
  useAuth: () => ({ user: { uid: "u1", email: "maria@example.com" }, plan: "premium", planLoading: false }),
}));
vi.mock("@/hooks/useNavCounts", () => ({
  useNavCounts: () => ({ "/next-actions": 3, "/strategy-alerts": 3 }),
}));

function renderSidebar() {
  return render(
    <MemoryRouter>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

describe("AppSidebar", () => {
  // Interview Prep had no way in and Ask lived only on the Dashboard (persona review, 2026-10-14).
  test("Interview Prep and Ask Applendium are in the nav", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: /Interview Prep/ })).toHaveAttribute("href", "/interview-prep");
    expect(screen.getByRole("link", { name: /Ask Applendium/ })).toHaveAttribute("href", "/ask");
  });

  test("the Strategy Alerts badge names a count of alerts", () => {
    renderSidebar();
    const link = screen.getByRole("link", { name: /Strategy Alerts/ });
    expect(within(link).getByLabelText("3 alerts")).toHaveTextContent("3");
  });
});
