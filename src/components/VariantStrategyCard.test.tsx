import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import {
  VariantStrategyCard,
  variantStrategyDocumentNote,
  variantStrategyNoGapsNote,
  variantStrategyPickLabel,
} from "./VariantStrategyCard";
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

/**
 * This card and the verdict above it can read two different résumés — that is by design, since
 * recommending a better-suited document for the role is the card's whole job. What was NOT by design
 * is doing it silently: a requirement the verdict counted as covered could appear here as a gap,
 * leaving the user to reconcile two confident, contradictory readings of "my résumé".
 */
describe("variantStrategyDocumentNote", () => {
  const twoDocuments: VariantStrategy = {
    ...strategy,
    analyzedVariant: { variantId: "variant-a", name: "QA-Focused", isDefault: false },
    scoredVariant: { variantId: "variant-b", name: "General" },
    analyzedDifferentDocument: true,
  };

  test("names both documents when the card read a different résumé than the verdict scored", () => {
    expect(variantStrategyDocumentNote(twoDocuments)).toBe(
      "These gaps are from QA-Focused. The verdict above was scored on General, so the two can disagree.",
    );
  });

  test("says nothing when both sides read the same document", () => {
    expect(
      variantStrategyDocumentNote({
        ...twoDocuments,
        scoredVariant: { variantId: "variant-a", name: "QA-Focused" },
        analyzedDifferentDocument: false,
      }),
    ).toBeNull();
  });

  test("says nothing when only one of the two documents can be named", () => {
    // "Different from something we can't identify" is a worse experience than the silence it
    // replaces — it raises a doubt the user has no way to resolve.
    expect(variantStrategyDocumentNote({ ...twoDocuments, scoredVariant: null })).toBeNull();
    expect(variantStrategyDocumentNote({ ...twoDocuments, analyzedVariant: null })).toBeNull();
  });

  test("a strategy from a backend that predates these fields is silent, not broken", () => {
    expect(variantStrategyDocumentNote(strategy)).toBeNull();
  });

  test("the note renders inside the card", () => {
    render(<VariantStrategyCard strategy={twoDocuments} />);
    expect(screen.getByText(/These gaps are from QA-Focused/)).toBeInTheDocument();
    expect(screen.getByText(/scored on General/)).toBeInTheDocument();
  });

  test("with no gaps to point at, the note does not say 'these gaps'", () => {
    // The first version of this note shipped and immediately pointed at nothing: the user's card had
    // zero gaps, so "These gaps are from New-Resume" referred to an empty list.
    const note = variantStrategyDocumentNote({ ...twoDocuments, gaps: [] });
    expect(note).not.toMatch(/these gaps/i);
    expect(note).toBe(
      "We checked QA-Focused here. The verdict above was scored on General, the one you picked for this run.",
    );
  });
});

/**
 * Naming a résumé under a "Résumé strategy" heading is a recommendation, and the card never said so.
 *
 * The founder ran a real QA posting, saw a document he had not selected, and asked why we analysed
 * the wrong one. We hadn't — we had recommended one. And the recommendation was a six-way tie
 * (every résumé covered all three must-haves), decided by the default flag, presented with the same
 * confidence a genuine winner would get.
 */
describe("variantStrategyPickLabel", () => {
  const requirementsPick: VariantStrategy = { ...strategy, recommended: { ...strategy.recommended, requiredCount: 3 } };

  test("a pick that beat the others is labelled a best match", () => {
    expect(variantStrategyPickLabel({ ...requirementsPick, isTieBreak: false })).toBe("Best match");
  });

  test("a tie is labelled as a tie, not as a match", () => {
    expect(variantStrategyPickLabel({ ...requirementsPick, isTieBreak: true, tiedCount: 6 })).toBe("Any of these work");
  });

  test("no readable requirements means we are only showing the default", () => {
    expect(
      variantStrategyPickLabel({ ...strategy, recommended: { ...strategy.recommended, requiredCount: 0 } }),
    ).toBe("Your default");
  });

  test("the outcomes basis is ranked on real results, so it never reports a tie", () => {
    expect(variantStrategyPickLabel(outcomeStrategy)).toBe("Best results so far");
  });

  test("the label and the computed reason both render — the reason used to be discarded", () => {
    render(<VariantStrategyCard strategy={{ ...requirementsPick, isTieBreak: true, tiedCount: 6 }} />);
    expect(screen.getByText("Any of these work")).toBeInTheDocument();
    expect(screen.getByText("Highest keyword match for this posting.")).toBeInTheDocument();
  });
});

describe("variantStrategyNoGapsNote", () => {
  test("stays silent while there are gaps to render", () => {
    expect(variantStrategyNoGapsNote(strategy)).toBeNull();
  });

  test("a clean read against real requirements says so plainly", () => {
    expect(
      variantStrategyNoGapsNote({
        ...strategy,
        gaps: [],
        recommended: { ...strategy.recommended, requiredCount: 3 },
        analyzedVariant: { variantId: "variant-a", name: "New-Resume", isDefault: true },
      }),
    ).toBe("Nothing to fix on New-Resume for this posting — send it as it is.");
  });

  test("an empty gap list with NO requirements read is not reported as a clean résumé", () => {
    // Two causes, opposite meanings, identical empty list. Calling the second one clean would be
    // the product congratulating a user on a check it never ran.
    const note = variantStrategyNoGapsNote({
      ...strategy,
      gaps: [],
      recommended: { ...strategy.recommended, requiredCount: 0 },
    });
    expect(note).toMatch(/couldn't read specific requirements/i);
    expect(note).toMatch(/not a clean bill of health/i);
  });

  test("the note renders where an empty panel used to be", () => {
    render(
      <VariantStrategyCard
        strategy={{ ...strategy, gaps: [], recommended: { ...strategy.recommended, requiredCount: 3 } }}
      />,
    );
    expect(screen.getByText(/Nothing to fix on QA-Focused/)).toBeInTheDocument();
  });
});
