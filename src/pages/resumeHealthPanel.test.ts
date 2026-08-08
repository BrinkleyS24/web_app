/**
 * The two empty states of a health panel are opposites and must never render the same.
 *
 * "We checked this résumé and found nothing" is a result. "We have no résumé to check" is the
 * absence of one. Collapsing them gives a user a clean bill of health we never established —
 * the same right-censoring mistake that put "No response 0" on the Apply Gate memory panel.
 */
import { describe, expect, test } from "vitest";

import { resumeHealthHeadline } from "./Resumes";
import type { ResumeHealthEntry, ResumeHealthFinding } from "@/lib/emails";

const finding = (over: Partial<ResumeHealthFinding> = {}): ResumeHealthFinding => ({
  key: "career_gap",
  title: "Unexplained gap in the dated history",
  severity: "important",
  evidence: "Your dated work history has an unexplained 23-month gap (May 2024 - Mar 2026).",
  action: "Account for it in one line where it sits.",
  dismissed: false,
  ...over,
});

const entry = (over: Partial<ResumeHealthEntry> = {}): ResumeHealthEntry => ({
  variantId: "v-1",
  name: "QA-focused",
  isDefault: true,
  document: { variantId: "v-1", source: "chosen", fingerprint: "abc123def456", characters: 2400 },
  findings: [],
  openCount: 0,
  ...over,
});

describe("resumeHealthHeadline", () => {
  test("renders nothing at all when there is no résumé to check", () => {
    expect(resumeHealthHeadline(undefined)).toBeNull();
    expect(resumeHealthHeadline(null)).toBeNull();
    // A row with no readable document is the same case: unchecked, not clean.
    expect(resumeHealthHeadline(entry({ document: null }))).toBeNull();
  });

  test("a checked résumé with nothing wrong says so", () => {
    expect(resumeHealthHeadline(entry())).toEqual({
      clean: true,
      text: "Nothing flagged on this version.",
    });
  });

  test("a résumé whose only findings are dismissed reads as clean", () => {
    const dismissedOnly = entry({ findings: [finding({ dismissed: true })] });
    expect(resumeHealthHeadline(dismissedOnly)?.clean).toBe(true);
  });

  test("one open finding is counted, not characterised", () => {
    expect(resumeHealthHeadline(entry({ findings: [finding()] }))).toEqual({
      clean: false,
      text: "1 thing worth fixing on this version.",
    });
  });

  test("several open findings report the count", () => {
    const two = entry({
      findings: [finding(), finding({ key: "quantified_evidence", severity: "suggested" })],
    });
    expect(resumeHealthHeadline(two)?.text).toBe("2 things worth fixing on this version.");
  });

  test("a blocking finding leads, because it is a different kind of problem", () => {
    // Nobody can reach you is not one more item on a list of polish suggestions.
    const blockingOnly = entry({
      findings: [finding({ key: "contact_reachable", severity: "blocking" })],
    });
    expect(resumeHealthHeadline(blockingOnly)?.text).toBe("1 thing here stops a reviewer reaching you.");

    const mixed = entry({
      findings: [
        finding({ key: "contact_reachable", severity: "blocking" }),
        finding(),
        finding({ key: "quantified_evidence", severity: "suggested" }),
      ],
    });
    expect(resumeHealthHeadline(mixed)?.text).toBe("3 things to fix — 1 stops a reviewer reaching you.");
  });

  test("the count comes from the findings, not from a separate number that can drift", () => {
    // openCount arrives from the backend too; trusting it here would let a stale field disagree
    // with the list rendered directly underneath it.
    const disagreeing = entry({ findings: [finding()], openCount: 7 });
    expect(resumeHealthHeadline(disagreeing)?.text).toBe("1 thing worth fixing on this version.");
  });
});
