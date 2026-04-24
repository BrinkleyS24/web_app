import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import PublicSiteLayout from "./PublicSiteLayout.jsx";

const useAuth = vi.fn();

vi.mock("../lib/AuthContext.jsx", () => ({
  useAuth: () => useAuth(),
}));

function renderLayout(authOverrides = {}) {
  const logout = vi.fn().mockResolvedValue(undefined);

  useAuth.mockReturnValue({
    user: null,
    plan: null,
    planLoading: false,
    adminEmail: false,
    logout,
    ...authOverrides,
  });

  render(
    <MemoryRouter>
      <PublicSiteLayout>
        <p>Public page body</p>
      </PublicSiteLayout>
    </MemoryRouter>,
  );

  return { logout };
}

describe("PublicSiteLayout", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("does not show public sign-out for anonymous visitors", () => {
    renderLayout();

    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });

  test("lets signed-in public users sign out", async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue(undefined);

    renderLayout({
      user: { email: "free@example.test" },
      plan: "free",
      logout,
    });

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
