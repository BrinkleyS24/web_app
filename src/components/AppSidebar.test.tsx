import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
afterEach(() => { vi.unstubAllEnvs(); });

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
  test('production hides Jobs while keeping the reviewed premium tools', () => {
    vi.stubEnv('DEV', false); vi.stubEnv('VITE_JOB_FEED_ENABLED', undefined);
    renderSidebar();
    expect(screen.queryByRole('link', { name: /^Jobs$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Resumes/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Next Actions/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Apply Gate/ })).toBeInTheDocument();
  });

  test('an explicit pilot opt-in restores the Jobs link', () => {
    vi.stubEnv('DEV', false); vi.stubEnv('VITE_JOB_FEED_ENABLED', 'true');
    renderSidebar();
    expect(screen.getByRole('link', { name: /^Jobs$/ })).toHaveAttribute('href', '/jobs');
  });
  // Interview Prep had no way in and Ask lived only on the Dashboard (persona review, 2026-10-14).
  test("Interview Prep and Ask Applendium are in the nav", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: /Interview Prep/ })).toHaveAttribute("href", "/interview-prep");
    expect(screen.getByRole("link", { name: /Ask Applendium/ })).toHaveAttribute("href", "/ask");
    expect(screen.getByRole("link", { name: /^Jobs$/ })).toHaveAttribute("href", "/jobs");
  });

  test("the Strategy Alerts badge names a count of alerts", () => {
    renderSidebar();
    const link = screen.getByRole("link", { name: /Strategy Alerts/ });
    expect(within(link).getByLabelText("3 alerts")).toHaveTextContent("3");
  });
});
