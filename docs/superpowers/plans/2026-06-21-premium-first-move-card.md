# Premium "First Move" Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cold-start "First Move" card to the premium dashboard that removes the buried-resume blocker and funnels a thin/new subscriber to their first Apply Gate verdict.

**Architecture:** One new self-contained React component (`FirstMoveCard`) mounted at the top of `DashboardNew`, plus a shared `useSaveResume` mutation hook extracted from `ResumePrompt`. The card derives its visibility/step purely from three existing queries (resume, apply-gate history, cohort metrics) — no backend changes. It auto-hides once the user has run a gate.

**Tech Stack:** Vite + React 18 + TypeScript + Tailwind + TanStack React Query + react-router-dom; tests with vitest + @testing-library/react. Repo: `frontend/web` (its own git repo).

Design spec: `frontend/web/docs/superpowers/specs/2026-06-21-premium-cold-start-first-move-card-design.md`

## Global Constraints

- All commands run from `frontend/web/`. Test runner: `npx vitest run <path>`.
- No backend changes, no new endpoints, no new dependencies.
- Reuse existing query keys verbatim so React Query shares cache with the dashboard:
  - resume: `["user-resume"]` (queryFn `fetchResume`)
  - apply-gate history: `["dashboard", "apply-gate-history"]` (queryFn `fetchApplyGateHistory`)
  - metrics: `["email-metrics", "last_30_days"]` (queryFn `() => fetchEmailMetrics("last_30_days")`)
- Resume "present" threshold: `resumeText.trim().length > 20` (matches `ResumePrompt`/Apply Gate).
- Established-cohort threshold: `cohortMetrics.applicationsSent >= 5`.
- localStorage dismiss key: `firstMove.dismissed`.
- Fail safe: signal queries loading → render nothing; signal query error → hide the card.
- Card copy is verbatim from the spec (voice rules from `PREMIUM_PRODUCT_STRATEGY.md`).

## File Structure

- **Create** `src/hooks/useSaveResume.ts` — shared resume-save mutation (trims input, invalidates `["user-resume"]`).
- **Create** `src/hooks/useSaveResume.test.tsx` — hook test.
- **Modify** `src/components/ResumePrompt.tsx` — use the shared hook instead of an inline save mutation.
- **Create** `src/components/FirstMoveCard.tsx` — the card.
- **Create** `src/components/FirstMoveCard.test.tsx` — the card's test matrix.
- **Modify** `src/pages/DashboardNew.tsx` — mount `<FirstMoveCard />` after the greeting header.
- **Modify** `src/pages/DashboardNew.test.tsx` — mock `fetchResume`; add cold-start regression assertions.

---

### Task 1: `useSaveResume` shared hook (+ ResumePrompt refactor)

**Files:**
- Create: `src/hooks/useSaveResume.ts`
- Create: `src/hooks/useSaveResume.test.tsx`
- Modify: `src/components/ResumePrompt.tsx`

**Interfaces:**
- Produces: `useSaveResume(): UseMutationResult<{ success: boolean }, Error, string>` — `mutate(resumeText)` saves the (trimmed) resume and invalidates `["user-resume"]`.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useSaveResume.test.tsx`:

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { useSaveResume } from "./useSaveResume";

const { saveResume } = vi.hoisted(() => ({ saveResume: vi.fn() }));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return { ...actual, saveResume };
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  saveResume.mockReset();
  saveResume.mockResolvedValue({ success: true });
});

describe("useSaveResume", () => {
  test("trims the input and calls saveResume", async () => {
    const { result } = renderHook(() => useSaveResume(), { wrapper });
    result.current.mutate("  a resume long enough to be valid  ");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(saveResume).toHaveBeenCalledWith("a resume long enough to be valid");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/useSaveResume.test.tsx`
Expected: FAIL — cannot resolve `./useSaveResume` (module not created yet).

- [ ] **Step 3: Create the hook**

Create `src/hooks/useSaveResume.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveResume } from "@/lib/emails";

/**
 * Shared resume-save mutation. Trims the input, persists it, and invalidates
 * the ["user-resume"] query so every consumer (ResumePrompt, FirstMoveCard,
 * Apply Gate) re-reads the saved value. Pass component-specific side effects
 * via mutate(text, { onSuccess }).
 */
export function useSaveResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resumeText: string) => saveResume(resumeText.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-resume"] });
    },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/useSaveResume.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Refactor ResumePrompt to use the hook**

In `src/components/ResumePrompt.tsx`:

Change the lib import (line 13) to drop `saveResume` (no longer used directly here):
```ts
import { fetchResume, deleteResume } from "@/lib/emails";
```

Add the hook import below the existing imports:
```ts
import { useSaveResume } from "@/hooks/useSaveResume";
```

Replace the inline save mutation (current lines 46–53):
```ts
  // ── Save mutation ──────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => saveResume(draft.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-resume"] });
      setEditing(false);
    },
  });
```
with:
```ts
  // ── Save mutation (shared hook) ───────────────────────────────
  const saveMutation = useSaveResume();
```

Update `handleSave` (current lines 66–68) to carry the component-specific side effect:
```ts
  const handleSave = useCallback(() => {
    if (draft.trim().length >= 20) {
      saveMutation.mutate(draft, { onSuccess: () => setEditing(false) });
    }
  }, [draft, saveMutation]);
```

(`useMutation` and `useQueryClient` imports stay — they are still used by `deleteMutation`. `saveMutation.isPending` / `.isError` / `.error` usages elsewhere in the file are unchanged: a mutation result still exposes them.)

- [ ] **Step 6: Verify the app still type-checks and the resume tests pass**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run src/hooks/useSaveResume.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useSaveResume.ts src/hooks/useSaveResume.test.tsx src/components/ResumePrompt.tsx
git commit -m "feat(premium): shared useSaveResume hook; ResumePrompt uses it"
```

---

### Task 2: `FirstMoveCard` component

**Files:**
- Create: `src/components/FirstMoveCard.tsx`
- Create: `src/components/FirstMoveCard.test.tsx`

**Interfaces:**
- Consumes: `useSaveResume` (Task 1); `fetchResume`, `fetchApplyGateHistory`, `fetchEmailMetrics` from `@/lib/emails`; `Button` from `@/components/ui/button`; `Link` from `react-router-dom`.
- Produces: `FirstMoveCard` (named export) — a self-contained card, no props. Renders a root with `data-testid="first-move-card"`, or `null` when not visible.

- [ ] **Step 1: Write the failing test**

Create `src/components/FirstMoveCard.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { FirstMoveCard } from "./FirstMoveCard";

const { fetchResume, fetchApplyGateHistory, fetchEmailMetrics, saveResume } = vi.hoisted(() => ({
  fetchResume: vi.fn(),
  fetchApplyGateHistory: vi.fn(),
  fetchEmailMetrics: vi.fn(),
  saveResume: vi.fn(),
}));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return { ...actual, fetchResume, fetchApplyGateHistory, fetchEmailMetrics, saveResume };
});

const RESUME = "Senior QA engineer with eight years of testing experience and SQL.";

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <FirstMoveCard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function metricsWith(applicationsSent: number) {
  return {
    success: true,
    timeframe: "last_30_days",
    metrics: {
      totalApplications: 0, totalInterviewed: 0, totalOffers: 0, totalRejected: 0,
      responseRate: 0, interviewRate: 0, offerRate: 0, rejectionRate: 0, totalEmails: 0,
    },
    cohortMetrics: {
      applicationsSent, reachedInterview: 0, reachedOffer: 0, rejectedCohorts: 0,
      interviewRate: 0, offerRate: 0, rejectionRate: 0,
      basis: "email_cohorts_all_time", ungroupableEmails: 0,
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  fetchResume.mockResolvedValue({ success: true, resumeText: null });
  fetchApplyGateHistory.mockResolvedValue({ success: true, history: [] });
  fetchEmailMetrics.mockResolvedValue(metricsWith(0));
  saveResume.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("FirstMoveCard", () => {
  test("no resume -> Step 1 with the resume input", async () => {
    renderCard();
    expect(await screen.findByText(/Get a verdict on the next role/)).toBeInTheDocument();
    expect(screen.getByLabelText("Resume text")).toBeInTheDocument();
  });

  test("resume saved, 0 runs -> Step 2 with the CTA to /apply-gate", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: RESUME });
    renderCard();
    const cta = await screen.findByRole("link", { name: /Run your first Apply Gate/ });
    expect(cta).toHaveAttribute("href", "/apply-gate");
  });

  test("established account -> Step 2 headline names the tracked applications", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: RESUME });
    fetchEmailMetrics.mockResolvedValue(metricsWith(42));
    renderCard();
    expect(
      await screen.findByText(/Apply Gate already knows your 42 tracked applications/),
    ).toBeInTheDocument();
  });

  test("thin account -> generic Step 2 headline (no count)", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: RESUME });
    fetchEmailMetrics.mockResolvedValue(metricsWith(2));
    renderCard();
    expect(await screen.findByText("Run Apply Gate on a role you're weighing.")).toBeInTheDocument();
    expect(screen.queryByText(/already knows your/)).not.toBeInTheDocument();
  });

  test(">= 1 gate run -> card hidden", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: RESUME });
    fetchApplyGateHistory.mockResolvedValue({ success: true, history: [{ id: "v1" }] });
    const { container } = renderCard();
    await waitFor(() => expect(fetchApplyGateHistory).toHaveBeenCalled());
    await waitFor(() =>
      expect(container.querySelector("[data-testid='first-move-card']")).toBeNull(),
    );
  });

  test("dismissed flag -> card hidden", async () => {
    localStorage.setItem("firstMove.dismissed", "true");
    const { container } = renderCard();
    await waitFor(() => expect(fetchResume).toHaveBeenCalled());
    expect(container.querySelector("[data-testid='first-move-card']")).toBeNull();
  });

  test("saving a resume advances to Step 2", async () => {
    const user = userEvent.setup();
    renderCard();
    const textarea = await screen.findByLabelText("Resume text");
    await user.type(textarea, RESUME);
    // The save invalidates ["user-resume"]; the refetch should now return it.
    fetchResume.mockResolvedValue({ success: true, resumeText: RESUME });
    await user.click(screen.getByRole("button", { name: /Save resume/ }));
    expect(
      await screen.findByRole("link", { name: /Run your first Apply Gate/ }),
    ).toBeInTheDocument();
  });

  test("save failure -> inline error, stays on Step 1, keeps the pasted text", async () => {
    const user = userEvent.setup();
    saveResume.mockRejectedValue(new Error("network"));
    renderCard();
    const textarea = await screen.findByLabelText("Resume text");
    await user.type(textarea, RESUME);
    await user.click(screen.getByRole("button", { name: /Save resume/ }));
    expect(await screen.findByText(/Couldn't save your resume/)).toBeInTheDocument();
    expect(screen.getByLabelText("Resume text")).toHaveValue(RESUME);
  });

  test("signal query error -> renders nothing", async () => {
    fetchResume.mockRejectedValue(new Error("boom"));
    const { container } = renderCard();
    await waitFor(() => expect(fetchResume).toHaveBeenCalled());
    await waitFor(() =>
      expect(container.querySelector("[data-testid='first-move-card']")).toBeNull(),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/FirstMoveCard.test.tsx`
Expected: FAIL — cannot resolve `./FirstMoveCard`.

- [ ] **Step 3: Create the component**

Create `src/components/FirstMoveCard.tsx`:

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Check, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApplyGateHistory, fetchEmailMetrics, fetchResume } from "@/lib/emails";
import { useSaveResume } from "@/hooks/useSaveResume";

const DISMISS_KEY = "firstMove.dismissed";
const ESTABLISHED_THRESHOLD = 5;

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "true");
  } catch {
    /* private mode — ignore */
  }
}

/**
 * Cold-start "First Move" card on the premium dashboard. Removes the buried-resume
 * blocker and funnels a thin/new subscriber to their first Apply Gate verdict.
 * Shows only when (no resume) OR (no Apply Gate runs yet); auto-hides afterward.
 */
export function FirstMoveCard() {
  const [dismissed, setDismissed] = useState(readDismissed);
  const [draft, setDraft] = useState("");

  const resumeQuery = useQuery({
    queryKey: ["user-resume"],
    queryFn: fetchResume,
    staleTime: 60_000,
  });
  const historyQuery = useQuery({
    queryKey: ["dashboard", "apply-gate-history"],
    queryFn: fetchApplyGateHistory,
    staleTime: 60_000,
  });
  const metricsQuery = useQuery({
    queryKey: ["email-metrics", "last_30_days"],
    queryFn: () => fetchEmailMetrics("last_30_days"),
    staleTime: 60_000,
  });

  const saveMutation = useSaveResume();

  // Fail safe: while the gating signals load, render nothing; on error, hide.
  if (resumeQuery.isLoading || historyQuery.isLoading) return null;
  if (resumeQuery.isError || historyQuery.isError) return null;

  const hasResume = Boolean(
    resumeQuery.data?.resumeText && resumeQuery.data.resumeText.trim().length > 20,
  );
  const runCount = historyQuery.data?.history?.length ?? 0;
  const applicationsSent = metricsQuery.data?.cohortMetrics?.applicationsSent ?? 0;

  const visible = !dismissed && (!hasResume || runCount === 0);
  if (!visible) return null;

  const handleDismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  const handleSave = () => {
    if (draft.trim().length >= 20) saveMutation.mutate(draft);
  };

  const step: 1 | 2 = hasResume ? 2 : 1;

  return (
    <div className="glass-card relative rounded-xl p-5 space-y-3" data-testid="first-move-card">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
        First move
      </p>

      {step === 1 ? (
        <>
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Get a verdict on the next role you're considering.
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Apply Gate reads your resume against any job posting and tells you apply,
                fix-first, or skip — grounded in your real history, not generic advice. Add
                your resume to start.
              </p>
            </div>
          </div>
          <textarea
            rows={6}
            aria-label="Resume text"
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="Paste your resume text here… (plain text, not a file)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Stored encrypted. Used only to evaluate roles for you.
          </p>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={draft.trim().length < 20 || saveMutation.isPending}
            onClick={handleSave}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {saveMutation.isPending ? "Saving…" : "Save resume"}
          </Button>
          {saveMutation.isError && (
            <p className="text-xs text-red-500">Couldn't save your resume — try again.</p>
          )}
        </>
      ) : (
        <>
          <h3 className="text-base font-semibold text-foreground">
            {applicationsSent >= ESTABLISHED_THRESHOLD
              ? `Apply Gate already knows your ${applicationsSent} tracked applications. Run it on a role you're weighing.`
              : "Run Apply Gate on a role you're weighing."}
          </h3>
          <p className="text-sm text-muted-foreground">
            Paste a job posting and get a grounded apply / fix-first / skip verdict — top
            rejection risks, missing proof, and what to fix today — in about 30 seconds.
          </p>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
            <Check className="h-3 w-3" />
            Resume saved
          </span>
          <div>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/apply-gate">
                Run your first Apply Gate
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/FirstMoveCard.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/FirstMoveCard.tsx src/components/FirstMoveCard.test.tsx
git commit -m "feat(premium): FirstMoveCard cold-start onboarding card"
```

---

### Task 3: Mount the card in DashboardNew (+ regression)

**Files:**
- Modify: `src/pages/DashboardNew.tsx` (add `<FirstMoveCard />` after the greeting header, ~line 559)
- Modify: `src/pages/DashboardNew.test.tsx` (mock `fetchResume`; add cold-start assertions)

**Interfaces:**
- Consumes: `FirstMoveCard` (Task 2).

- [ ] **Step 1: Update the dashboard test to mock `fetchResume` and assert card behavior**

In `src/pages/DashboardNew.test.tsx`:

Add `fetchResume` to the hoisted mock object (alongside the existing fns):
```ts
const {
  fetchApplicationStats,
  fetchApplyGateHistory,
  fetchEmailMetrics,
  fetchRankedActionQueue,
  fetchResume,
  fetchStrategyAlerts,
  fetchSuggestionOutcomeAnalytics,
  startEmailSync,
} = vi.hoisted(() => ({
  fetchApplicationStats: vi.fn(),
  fetchApplyGateHistory: vi.fn(),
  fetchEmailMetrics: vi.fn(),
  fetchRankedActionQueue: vi.fn(),
  fetchResume: vi.fn(),
  fetchStrategyAlerts: vi.fn(),
  fetchSuggestionOutcomeAnalytics: vi.fn(),
  startEmailSync: vi.fn(),
}));
```

Add `fetchResume` to the `vi.mock("@/lib/emails", ...)` return object:
```ts
    fetchResume,
```

In `beforeEach`, give it a default that (combined with the existing 1-item apply-gate history) keeps the card hidden:
```ts
  fetchResume.mockResolvedValue({
    success: true,
    resumeText: "A saved resume that is comfortably longer than twenty characters.",
  });
```

In the existing test (`"renders the MVP command center …"`), add at the end:
```ts
    expect(screen.queryByTestId("first-move-card")).not.toBeInTheDocument();
```

Add a new test inside the `describe("DashboardNew", …)` block:
```ts
  test("shows the First Move card for a cold-start account", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: null });
    fetchApplyGateHistory.mockResolvedValue({ success: true, history: [] });

    renderDashboard();

    expect(await screen.findByTestId("first-move-card")).toBeInTheDocument();
    expect(screen.getByText(/Get a verdict on the next role/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the dashboard test to verify the new test fails**

Run: `npx vitest run src/pages/DashboardNew.test.tsx`
Expected: FAIL — `findByTestId("first-move-card")` not found (card not mounted yet). The existing test still passes.

- [ ] **Step 3: Mount the card in DashboardNew**

In `src/pages/DashboardNew.tsx`, add the import near the other component imports:
```ts
import { FirstMoveCard } from "@/components/FirstMoveCard";
```

In the render, immediately after the greeting-header block closes (the `</div>` that ends the `flex flex-wrap items-end justify-between` header, ~line 559) and before the next section, insert:
```tsx
        <FirstMoveCard />
```

So the top of the returned tree reads:
```tsx
      <div className="space-y-3.5">
        {/* Greeting header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          {/* …greeting + Sync button… */}
        </div>

        <FirstMoveCard />

        {/* …existing sections… */}
```

- [ ] **Step 4: Run the dashboard test to verify it passes**

Run: `npx vitest run src/pages/DashboardNew.test.tsx`
Expected: PASS (both tests — card hidden for the rich/established mock, shown for the cold-start mock).

- [ ] **Step 5: Full check**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: the whole suite passes (no regressions).

- [ ] **Step 6: Commit**

```bash
git add src/pages/DashboardNew.tsx src/pages/DashboardNew.test.tsx
git commit -m "feat(premium): mount FirstMoveCard on the dashboard"
```

---

## Self-Review

- **Spec coverage:** trigger/lifecycle (Task 2 visibility derivation), Step 1 + Step 2 content incl. cohort headline (Task 2), resume capture via shared hook (Task 1), architecture/reused queries (Tasks 2–3), error handling — save failure, query loading/error, localStorage guard (Task 2 tests + component), dismiss (Task 2), mount + regression (Task 3). All covered.
- **No placeholders:** every step has runnable commands and complete code.
- **Type consistency:** query keys, `useSaveResume` signature, `cohortMetrics.applicationsSent`, `history.length`, and `resumeText` shape match the verified lib signatures across tasks.
- **Manual smoke (post-merge, optional):** run the web app, sign in as a thin account (no resume) → see Step 1 → paste resume → Step 2 → click through to `/apply-gate`. Confirmed automatically by the test matrix; manual pass is a courtesy check.
