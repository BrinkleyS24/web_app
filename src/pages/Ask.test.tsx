import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import AskPage from "./Ask";

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("Ask page", () => {
  // Ask had no page of its own before 2026-10-14; it reuses the Dashboard's component.
  test("renders the Ask Applendium box with its suggestions", () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <AskPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Ask Applendium" })).toBeInTheDocument();
    expect(screen.getByText("What should I follow up on?")).toBeInTheDocument();
  });
});
