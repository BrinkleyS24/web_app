import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { fetchPremiumPrice } = vi.hoisted(() => ({ fetchPremiumPrice: vi.fn() }));
vi.mock("../lib/premiumCheckout.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/premiumCheckout.js")>()),
  fetchPremiumPrice,
}));
vi.mock("../lib/usePageMetadata.js", () => ({ default: () => {} }));

import Landing from "./Landing.jsx";

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
}

function heroRows() {
  const hero = screen.getByTestId("hero-section");
  // Row buttons are the ones that show a role under a company name.
  return within(hero).queryAllByRole("button").filter((b) => b.textContent?.includes("ago") || b.textContent?.includes("Today") || b.textContent?.includes("Yesterday"));
}

describe("Landing (2026-10-14 persona findings)", () => {
  beforeEach(() => {
    fetchPremiumPrice.mockResolvedValue({
      unitAmount: 2499, currency: "usd", interval: "month", intervalCount: 1,
      quarterly: { unitAmount: 5900, currency: "usd", interval: "month", intervalCount: 3 },
    });
  });

  test("every demo tile filters the sample list, including Interviews and Offers", async () => {
    renderLanding();
    expect(heroRows().length).toBe(5);

    fireEvent.click(screen.getByTestId("hero-tile-interviews"));
    await waitFor(() => expect(heroRows().map((r) => r.textContent)).toEqual([expect.stringContaining("Mercy General Hospital")]));
    expect(screen.getByTestId("hero-tile-interviews")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("hero-tile-offers"));
    await waitFor(() => expect(heroRows().map((r) => r.textContent)).toEqual([expect.stringContaining("Northline Logistics")]));
  });

  test("sample employers are not all tech, and there is no fit percentage", () => {
    renderLanding();
    for (const name of ["Riverside Unified School District", "Mercy General Hospital", "Northline Logistics", "Harbor & Main"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/fit \d+%/i)).toBeNull();
    expect(screen.getByText(/tap a tile to filter/)).toBeInTheDocument();
  });

  test("phone visitors get a way to send themselves the install link", () => {
    renderLanding();
    const note = screen.getByTestId("phone-install-note");
    expect(note).toHaveTextContent("runs in Chrome on a computer");
    expect(screen.getByTestId("phone-install-email").getAttribute("href")).toMatch(/^mailto:\?subject=Install%20Applendium/);
    expect(screen.getByTestId("phone-install-copy")).toBeInTheDocument();
  });

  test("section labels use the AA-contrast grey, and Premium lists Interview Prep and Ask", async () => {
    renderLanding();
    expect(screen.getByText("How it works", { selector: "p" }).className).toContain("text-[#5C6470]");
    expect(screen.getByText("General support").className).toContain("text-[#5C6470]");
    expect(screen.getByText("Interview Prep")).toBeInTheDocument();
    expect(screen.getByText("Ask Applendium™")).toBeInTheDocument();
    expect(screen.queryByText("Weekly Summary")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("landing-price-note")).toHaveTextContent("or $59/3 mo"));
    expect(screen.getByTestId("footer-privacy-link")).toHaveAttribute("href", "/privacy");
  });
  test("Sign in follows the extension-first story and the wordmark has one spelling (2026-10-15)", () => {
    renderLanding();
    // It used to open /upgrade (a price list) while workspace pages said to sign in through the extension.
    expect(screen.getByTestId("nav-sign-in")).toHaveAttribute("href", "/dashboard");
    expect(screen.getAllByRole("link", { name: /^Sign in$/ }).every((link) => link.getAttribute("href") === "/dashboard")).toBe(true);
    expect(document.body.textContent).not.toContain("applendium™");
    expect(screen.getByTestId("logo-link")).toHaveTextContent("Applendium™");
  });
});
