import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { PremiumEmptyState } from "./PremiumEmptyState";

function renderEmpty(ui: React.ReactNode) {
  const queryClient = new QueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("PremiumEmptyState", () => {
  test("cold-start: renders the CTA link to its target", () => {
    renderEmpty(
      <PremiumEmptyState
        icon={TrendingUp}
        title="Run a few roles through Apply Gate"
        body="Once a requirement recurs across two or more roles, it shows up here."
        cta={{ label: "Run Apply Gate", to: "/apply-gate" }}
      />,
    );
    expect(screen.getByText("Run a few roles through Apply Gate")).toBeInTheDocument();
    expect(screen.getByText(/Once a requirement recurs/)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /Run Apply Gate/ });
    expect(cta).toHaveAttribute("href", "/apply-gate");
  });

  test("caught-up: no CTA when cta is omitted", () => {
    renderEmpty(<PremiumEmptyState title="No high or medium strategy alerts right now." />);
    expect(screen.getByText("No high or medium strategy alerts right now.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
