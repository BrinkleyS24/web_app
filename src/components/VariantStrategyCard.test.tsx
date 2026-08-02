import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { VariantStrategyCard } from "./VariantStrategyCard";
import type { VariantStrategy } from "@/lib/emails";

const strategy: VariantStrategy = {
  recommended: {
    variantId: "variant-a",
    name: "QA-Focused",
    basis: "requirements",
    sampleSize: 0,
    reason: "Highest keyword match for this posting.",
  },
  alternatives: [],
  basisLabel: "Based on this role's requirements",
  gaps: [
    {
      type: "buried",
      requirement: "Selenium automation",
      location: "experience",
      severity: "high",
      draft: {
        target: "bullet",
        before: "Wrote automated tests using various tools.",
        after: "Built and maintained Selenium-based regression suite covering 400+ UI test cases.",
      },
      skipSignal: false,
    },
    {
      type: "missing",
      requirement: "OSHA 30 certification",
      location: "none",
      severity: "high",
      draft: null,
      skipSignal: true,
    },
  ],
};

const outcomeStrategy: VariantStrategy = {
  recommended: {
    variantId: "variant-b",
    name: "Backend-Focused",
    basis: "your_outcomes",
    sampleSize: 5,
    reason: "Higher interview rate for similar roles.",
    outcomeBand: { kind: "stronger", sampleSize: 5, comparison: "roles like this" },
  },
  alternatives: [],
  basisLabel: "Based on your 5 applications with this résumé to roles like this",
  gaps: [],
};

describe("VariantStrategyCard", () => {
  test("renders the recommended variant name and basis label", () => {
    render(<VariantStrategyCard strategy={strategy} />);
    expect(screen.getByText("QA-Focused")).toBeInTheDocument();
    expect(screen.getByText("Based on this role's requirements")).toBeInTheDocument();
  });

  test("renders a buried gap with Accept and Dismiss buttons", () => {
    render(<VariantStrategyCard strategy={strategy} />);
    expect(screen.getByText("Buried")).toBeInTheDocument();
    expect(screen.getByText("Selenium automation")).toBeInTheDocument();
    expect(screen.getByText("Shows up only in your experience — surface it")).toBeInTheDocument();
    expect(screen.getByText("Wrote automated tests using various tools.")).toBeInTheDocument();
    expect(screen.getByText("Built and maintained Selenium-based regression suite covering 400+ UI test cases.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  test("renders a missing gap with the honest note and NO draft or Accept/Dismiss", () => {
    render(<VariantStrategyCard strategy={strategy} />);
    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.getByText("OSHA 30 certification")).toBeInTheDocument();
    expect(
      screen.getByText("You may not have provable experience here — consider whether this role fits"),
    ).toBeInTheDocument();
    // No Accept/Dismiss for a missing/skipSignal gap
    expect(screen.queryAllByRole("button", { name: "Accept" })).toHaveLength(1); // only for the buried gap
    expect(screen.queryAllByRole("button", { name: "Dismiss" })).toHaveLength(1); // only for the buried gap
  });

  test("clicking Accept calls onDraftDecisionsChange with the accepted requirement", async () => {
    const onDraftDecisionsChange = vi.fn();
    render(<VariantStrategyCard strategy={strategy} onDraftDecisionsChange={onDraftDecisionsChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(onDraftDecisionsChange).toHaveBeenLastCalledWith({
      accepted: ["Selenium automation"],
      dismissed: [],
    });
  });

  test("clicking Dismiss calls onDraftDecisionsChange with the dismissed requirement", async () => {
    const onDraftDecisionsChange = vi.fn();
    render(<VariantStrategyCard strategy={strategy} onDraftDecisionsChange={onDraftDecisionsChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDraftDecisionsChange).toHaveBeenLastCalledWith({
      accepted: [],
      dismissed: ["Selenium automation"],
    });
  });

  test("shows 'Draft accepted' confirmation after accepting, hiding Accept/Dismiss buttons", async () => {
    render(<VariantStrategyCard strategy={strategy} />);

    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(screen.getByText("Draft accepted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  test("shows 'Dismissed' confirmation after dismissing, hiding Accept/Dismiss buttons", async () => {
    const onDraftDecisionsChange = vi.fn();
    render(<VariantStrategyCard strategy={strategy} onDraftDecisionsChange={onDraftDecisionsChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.getByText("Dismissed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
    expect(onDraftDecisionsChange).toHaveBeenLastCalledWith({
      accepted: [],
      dismissed: ["Selenium automation"],
    });
  });

  test("your_outcomes: renders learning badge and basisLabel without any percentage", () => {
    const { container } = render(<VariantStrategyCard strategy={outcomeStrategy} />);
    expect(screen.getByText(/Learning from your 5 outcomes/i)).toBeInTheDocument();
    expect(
      screen.getByText("Based on your 5 applications with this résumé to roles like this"),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/%/);
  });

  test("requirements (regression): learning badge is not rendered", () => {
    render(<VariantStrategyCard strategy={strategy} />);
    expect(screen.queryByText(/Learning from your/i)).not.toBeInTheDocument();
  });

  test("a buried gap shows the existing line it would rewrite", () => {
    render(<VariantStrategyCard strategy={strategy} />);
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(screen.getByText("Wrote automated tests using various tools.")).toBeInTheDocument();
  });

  test("a reframe with no line to replace renders a suggestion, not an empty Before box", () => {
    const reframeStrategy: VariantStrategy = {
      ...strategy,
      gaps: [
        {
          type: "reframe",
          requirement: "test automation",
          location: "none",
          severity: "high",
          draft: {
            target: "summary",
            before: null,
            after: "Authored test automation suites using Playwright, Jest, and Supertest.",
          },
          skipSignal: false,
        },
      ],
    };

    render(<VariantStrategyCard strategy={reframeStrategy} />);
    expect(screen.queryByText("Before")).not.toBeInTheDocument();
    expect(screen.getByText("Suggested line")).toBeInTheDocument();
    expect(
      screen.getByText("Authored test automation suites using Playwright, Jest, and Supertest."),
    ).toBeInTheDocument();
  });
});
