import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, CircleCheck, FileText, Loader2, Plus, Star, Trash2, X } from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel, ToneChip } from "@/components/premium/PremiumUI";
import { BUTTON, CARD, EYEBROW, TONES, type Tone } from "@/components/premium/tone";
import {
  fetchResumeVariants,
  fetchVariantScoreboard,
  fetchApplicationStats,
  fetchResumeHealth,
  setResumeHealthFinding,
  createResumeVariant,
  setDefaultResumeVariant,
  archiveResumeVariant,
  type VariantScoreRow,
  type VariantBreakdownRow,
  type ResumeHealthEntry,
  type ResumeHealthFinding,
  type ResumeVariant,
  type VariantRecommendation,
} from "@/lib/emails";
import { cn } from "@/lib/utils";
import { STATUS_TONE } from "@/lib/statusTone";

const VARIANT_NUDGE_DISMISS_KEY = "variantNudge.dismissed";

function readVariantNudgeDismissed(): boolean {
  try {
    return localStorage.getItem(VARIANT_NUDGE_DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

function writeVariantNudgeDismissed() {
  try {
    localStorage.setItem(VARIANT_NUDGE_DISMISS_KEY, "true");
  } catch {
    /* private mode — ignore */
  }
}

const OUTCOME_CHIP: Record<VariantBreakdownRow["outcome"], { label: string; tone: Tone }> = {
  interviewed: { label: "Interviewed", tone: STATUS_TONE.interview },
  offered: { label: "Offered", tone: STATUS_TONE.offer },
  rejected: { label: "Rejected", tone: STATUS_TONE.rejected },
  no_response: { label: "No response", tone: STATUS_TONE.waiting },
  pending: { label: "Pending", tone: STATUS_TONE.applied },
};

function recordLine(score: VariantScoreRow | undefined) {
  const sent = score?.sent ?? 0;
  if (sent === 0) {
    return "No applications through this résumé yet — pick it in Apply Gate when you apply.";
  }
  // The headline count is the real number of applications sent through this
  // résumé (sent), NOT matchedToOutcome. matchedToOutcome only counts the
  // applications we've since been able to attribute an inbox outcome to, so
  // showing it as "applications" undercounts (5 applies could read as "1").
  const sentLabel = `${sent} application${sent === 1 ? "" : "s"} through this résumé`;
  if (!score || !score.sufficientSample) {
    const matched = score?.matchedToOutcome ?? 0;
    if (matched === 0) {
      return `${sentLabel} — waiting on inbox replies before we can call it.`;
    }
    return `${sentLabel} · ${matched} with a tracked outcome so far — not enough to call it yet.`;
  }
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return `${sentLabel} · ${plural(score.interviewed, "interview")} · ${plural(score.offered, "offer")} · ${plural(score.rejected, "rejected")} · ${score.noResponse} no response`;
}

/**
 * One line answering "is this résumé in good shape?" before any list of findings.
 *
 * Exported for its own test: the interesting cases are the two empty ones, which read very
 * differently. Nothing flagged means we checked and found nothing. No résumé to check means we
 * have not looked — and a health panel that renders those identically is claiming a clean bill
 * of health it never established.
 */
export function resumeHealthHeadline(entry: ResumeHealthEntry | undefined | null) {
  if (!entry || !entry.document) return null;
  const open = entry.findings.filter((f) => !f.dismissed);
  if (open.length === 0) return { clean: true as const, text: "Nothing flagged on this version." };
  const blocking = open.filter((f) => f.severity === "blocking").length;
  if (blocking > 0) {
    return {
      clean: false as const,
      text: blocking === 1 && open.length === 1
        ? "1 thing here stops a reviewer reaching you."
        : `${open.length} things to fix — ${blocking} stops a reviewer reaching you.`,
    };
  }
  return {
    clean: false as const,
    text: open.length === 1 ? "1 thing worth fixing on this version." : `${open.length} things worth fixing on this version.`,
  };
}

const SEVERITY_TONE: Record<ResumeHealthFinding["severity"], Tone> = {
  blocking: "risk",
  important: "attention",
  suggested: "neutral",
};

const SEVERITY_LABEL: Record<ResumeHealthFinding["severity"], string> = {
  blocking: "Fix first",
  important: "Worth fixing",
  suggested: "Suggestion",
};

function ResumeHealthBlock({
  entry,
  onSetState,
  pendingKey,
}: {
  entry: ResumeHealthEntry | undefined;
  onSetState: (finding: ResumeHealthFinding, next: "dismissed" | "active") => void;
  pendingKey: string | null;
}) {
  const [showDismissed, setShowDismissed] = useState(false);
  const headline = resumeHealthHeadline(entry);
  if (!entry || !headline) return null;

  const open = entry.findings.filter((f) => !f.dismissed);
  const dismissed = entry.findings.filter((f) => f.dismissed);

  return (
    <div className="space-y-2.5">
      <p className={cn("flex items-center gap-1.5 text-[13px] font-semibold", headline.clean ? TONES.positive.text : "text-foreground")}>
        {headline.clean ? <CircleCheck className="h-4 w-4" aria-hidden="true" /> : null}
        {headline.text}
      </p>

      {open.map((finding) => {
        const tone = SEVERITY_TONE[finding.severity];
        return (
          <div key={finding.key} className={cn("rounded-xl border px-4 py-3", TONES[tone].surface)}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <ToneChip tone={tone}>{SEVERITY_LABEL[finding.severity]}</ToneChip>
                <p className="text-[13px] font-semibold text-foreground">{finding.title}</p>
              </div>
              <button
                type="button"
                onClick={() => onSetState(finding, "dismissed")}
                disabled={pendingKey === finding.key}
                className={cn(BUTTON.ghost, "px-2 py-1 text-[12px]")}
              >
                Not an issue
              </button>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{finding.evidence}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground">{finding.action}</p>
          </div>
        );
      })}

      {dismissed.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowDismissed((v) => !v)}
            className="flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={showDismissed}
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showDismissed ? "rotate-180" : ""}`} />
            {showDismissed ? "Hide" : `${dismissed.length} dismissed`}
          </button>
          {showDismissed
            ? dismissed.map((finding) => (
                <div key={finding.key} className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <p className="text-[12px] text-muted-foreground">{finding.evidence}</p>
                  <button
                    type="button"
                    onClick={() => onSetState(finding, "active")}
                    disabled={pendingKey === finding.key}
                    className="shrink-0 text-[12px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
                  >
                    Undo
                  </button>
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

function ApplicationsDrilldown({ rows }: { rows: VariantBreakdownRow[] }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={open}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide applications" : `Show ${rows.length} application${rows.length === 1 ? "" : "s"}`}
      </button>
      {open ? (
        <div className="space-y-1.5">
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {rows.map((row, i) => {
              const chip = OUTCOME_CHIP[row.outcome] ?? OUTCOME_CHIP.pending;
              // Name the application by whatever the inbox knows — never "Unknown role".
              const primary = row.role ?? row.company ?? "Application";
              const secondary = row.role && row.company ? row.company : null;
              return (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{primary}</span>
                    {secondary ? <span className="ml-2 text-muted-foreground">{secondary}</span> : null}
                  </span>
                  <ToneChip tone={chip.tone}>{chip.label}</ToneChip>
                </li>
              );
            })}
          </ul>
          {rows.some((r) => r.outcome === "pending") ? (
            <p className="text-[12px] text-muted-foreground">Pending applications aren't counted in the rate.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The page promises "see which one actually gets interviews", and six stacked cards made the user do
 * the comparing (review, 2026-09-26). This is the comparison: one row per version, the backend's own
 * recommendation as the answer when it has one, and "needs N more" instead of a rate the sample
 * cannot support.
 */
function VariantComparison({
  variants,
  scoreByVariant,
  openFindingsByVariant,
  minSample,
  recommendation,
}: {
  variants: ResumeVariant[];
  scoreByVariant: Map<string, VariantScoreRow>;
  openFindingsByVariant: Map<string, number | null>;
  minSample: number | null;
  recommendation: VariantRecommendation;
}) {
  const rows = [...variants].sort((a, b) => {
    if (a.id === recommendation?.variantId) return -1;
    if (b.id === recommendation?.variantId) return 1;
    return (scoreByVariant.get(b.id)?.sent ?? 0) - (scoreByVariant.get(a.id)?.sent ?? 0);
  });
  const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  const td = "px-3 py-2.5 text-[13px] tabular-nums";

  return (
    <Panel
      title="Which version works"
      description={
        recommendation
          ? undefined
          : minSample
            ? `A version gets a rate once ${minSample} of its applications have an outcome from your inbox.`
            : undefined
      }
    >
      {recommendation ? (
        <p className="mb-3 text-[14px] leading-relaxed text-foreground">
          <span className="font-semibold">{recommendation.name}</span> is getting the most interviews:{" "}
          <span className="font-semibold">{Math.round(recommendation.interviewRate)}%</span> of its applications with an outcome.
        </p>
      ) : null}
      <div className="-mx-1 overflow-x-auto">
        {/* On a phone the counts step aside and the answer columns stay: version, rate, health. */}
        <table className="w-full border-collapse sm:min-w-[520px]">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={th}>Version</th>
              <th scope="col" className={cn(th, "hidden text-right sm:table-cell")}>Sent</th>
              <th scope="col" className={cn(th, "hidden text-right sm:table-cell")}>With an outcome</th>
              <th scope="col" className={cn(th, "hidden text-right sm:table-cell")}>Interviews</th>
              <th scope="col" className={cn(th, "text-right")}>Interview rate</th>
              <th scope="col" className={th}>Résumé health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((variant) => {
              const score = scoreByVariant.get(variant.id);
              const matched = score?.matchedToOutcome ?? 0;
              const needed = minSample != null ? Math.max(0, minSample - matched) : null;
              const open = openFindingsByVariant.get(variant.id);
              return (
                <tr key={variant.id}>
                  <th scope="row" className="px-3 py-2.5 text-left">
                    <a href={`#resume-${variant.id}`} className="text-[13px] font-semibold text-foreground underline-offset-2 hover:underline">
                      {variant.name}
                    </a>
                    <span className="ml-2 inline-flex gap-1.5 align-middle">
                      {variant.id === recommendation?.variantId ? <ToneChip tone="positive">Most interviews</ToneChip> : null}
                      {variant.isDefault ? <ToneChip tone="brand">Default</ToneChip> : null}
                    </span>
                  </th>
                  <td className={cn(td, "hidden text-right text-foreground sm:table-cell")}>{score?.sent ?? 0}</td>
                  <td className={cn(td, "hidden text-right text-foreground sm:table-cell")}>{matched}</td>
                  <td className={cn(td, "hidden text-right text-foreground sm:table-cell")}>
                    {score?.interviewed ?? 0}
                    {score?.offered ? <span className="ml-1 text-muted-foreground">· {score.offered} offer{score.offered === 1 ? "" : "s"}</span> : null}
                  </td>
                  <td className={cn(td, "text-right")}>
                    {score?.sufficientSample && score.interviewRate != null ? (
                      <span className="font-semibold text-foreground">{Math.round(score.interviewRate)}%</span>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">{needed ? `needs ${needed} more` : "—"}</span>
                    )}
                  </td>
                  <td className={cn(td, "text-[12.5px]")}>
                    {open == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : open === 0 ? (
                      <span className={TONES.positive.text}>Nothing flagged</span>
                    ) : (
                      <a href={`#resume-${variant.id}`} className={cn("font-medium underline-offset-2 hover:underline", TONES.attention.text)}>
                        {open} to fix
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const Resumes = () => {
  const queryClient = useQueryClient();
  const variantsQuery = useQuery({ queryKey: ["resume-variants"], queryFn: fetchResumeVariants });
  const scoreboardQuery = useQuery({ queryKey: ["variant-scoreboard"], queryFn: () => fetchVariantScoreboard() });
  const statsQuery = useQuery({ queryKey: ["application-stats"], queryFn: fetchApplicationStats });
  const healthQuery = useQuery({ queryKey: ["resume-health"], queryFn: fetchResumeHealth });

  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draft, setDraft] = useState("");
  const [nudgeDismissed, setNudgeDismissed] = useState(readVariantNudgeDismissed);

  const variants = variantsQuery.data?.variants ?? [];
  const scoreByVariant = new Map(
    (scoreboardQuery.data?.scoreboard?.perVariant ?? []).map((r) => [r.variantId, r]),
  );
  const breakdown = scoreboardQuery.data?.breakdown ?? {};

  // Nudge toward a second variant: with only one résumé on file, Apply Gate has
  // nothing to compare and the outcome-steering guidance can never fire. A
  // rejection is the natural moment to suggest trying a different version.
  const rejectedCount = statsQuery.data?.stats?.applications?.rejected ?? 0;
  const showVariantNudge =
    !nudgeDismissed &&
    !variantsQuery.isLoading &&
    !statsQuery.isLoading &&
    variants.length === 1 &&
    rejectedCount > 0;
  const dismissVariantNudge = () => {
    writeVariantNudgeDismissed();
    setNudgeDismissed(true);
  };

  const healthByVariant = new Map(
    (healthQuery.data?.resumes ?? []).map((entry) => [entry.variantId, entry]),
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["resume-variants"] });
    queryClient.invalidateQueries({ queryKey: ["variant-scoreboard"] });
    // A new or edited résumé is a different document, so its findings are recomputed from
    // scratch — there is no stored "resolved" state that could go stale against the text.
    queryClient.invalidateQueries({ queryKey: ["resume-health"] });
  };
  const createMut = useMutation({
    mutationFn: createResumeVariant,
    onSuccess: () => { setDraft(""); setDraftName(""); setAdding(false); invalidate(); },
  });
  const setDefaultMut = useMutation({ mutationFn: setDefaultResumeVariant, onSuccess: invalidate });
  const archiveMut = useMutation({ mutationFn: archiveResumeVariant, onSuccess: invalidate });
  const healthMut = useMutation({
    mutationFn: setResumeHealthFinding,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resume-health"] }),
  });
  const pendingHealthKey = healthMut.isPending ? healthMut.variables?.key ?? null : null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        <PageHeader
          eyebrow="Your résumé library"
          title="Résumés"
          description="Save the versions you tailor, then see which one actually gets interviews — and which gets auto-rejected."
          actions={
            !adding && variants.length > 0 ? (
              <button type="button" className={BUTTON.secondary} onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Add a résumé version
              </button>
            ) : null
          }
        />

        {showVariantNudge ? (
          <div className={cn("relative rounded-2xl border p-5", TONES.brand.surface)}>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismissVariantNudge}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", TONES.brand.icon)}>
                <FileText className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[14px] font-semibold leading-snug text-foreground">
                  {rejectedCount === 1
                    ? "You've had a rejection. Try a different résumé next time."
                    : `You've had ${rejectedCount} rejections. Try a different résumé next time.`}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  Save a second version and Apply Gate will start tracking which one actually gets responses.
                </p>
                <button type="button" className={cn(BUTTON.accent, "mt-3")} onClick={() => setAdding(true)}>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add a résumé version
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {variants.length >= 2 ? (
          <VariantComparison
            variants={variants}
            scoreByVariant={scoreByVariant}
            openFindingsByVariant={
              new Map(variants.map((v) => {
                const entry = healthByVariant.get(v.id);
                return [v.id, entry?.document ? entry.findings.filter((f) => !f.dismissed).length : null];
              }))
            }
            minSample={scoreboardQuery.data?.scoreboard?.minSample ?? null}
            recommendation={scoreboardQuery.data?.recommendation ?? null}
          />
        ) : null}

        {adding ? (
          <Panel title="Add a résumé version" description="Paste the text of the version you send. Apply Gate reads this text, not the file.">
            <div className="space-y-3">
              <label className="block">
                <span className={EYEBROW}>Name</span>
                <input
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Name (e.g., QA-focused)"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={EYEBROW}>Résumé text</span>
                <textarea
                  rows={12}
                  className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Paste your résumé text here… (plain text, not a file)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              {createMut.isError ? <ErrorState title="That version did not save" detail="Nothing was lost — try again." /> : null}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={BUTTON.primary}
                  disabled={draft.trim().length < 20 || createMut.isPending}
                  onClick={() => createMut.mutate({ name: draftName.trim() || "My résumé", text: draft })}
                >
                  {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save
                </button>
                <button type="button" className={BUTTON.ghost} onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </div>
          </Panel>
        ) : null}

        {variantsQuery.isLoading ? (
          <Panel>
            <LoadingRows rows={2} />
          </Panel>
        ) : variantsQuery.isError ? (
          <ErrorState title="Your résumés did not load" onRetry={() => variantsQuery.refetch()} />
        ) : variants.length === 0 ? (
          adding ? null : (
            <EmptyState
              icon={FileText}
              title="No résumés saved yet"
              body="Add the version you send most. Apply Gate checks every role against it, and once you save a second version it tracks which one gets responses."
              action={
                <button type="button" className={BUTTON.primary} onClick={() => setAdding(true)}>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add a résumé version
                </button>
              }
            />
          )
        ) : (
          <div className="space-y-4">
            {variants.map((v) => (
              <article key={v.id} id={`resume-${v.id}`} className={cn(CARD, "scroll-mt-24 space-y-4 p-5")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", TONES.brand.icon)}>
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-foreground">{v.name}</h2>
                        {v.isDefault ? <ToneChip tone="brand">Default</ToneChip> : null}
                      </div>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">{recordLine(scoreByVariant.get(v.id))}</p>
                    </div>
                  </div>
                  <div className="-ml-2 flex shrink-0 items-center gap-1 sm:ml-0">
                    {!v.isDefault ? (
                      <button type="button" className={BUTTON.ghost} onClick={() => setDefaultMut.mutate(v.id)}>
                        <Star className="h-3.5 w-3.5" aria-hidden /> Make default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={cn(BUTTON.ghost, "hover:bg-destructive/10 hover:text-destructive")}
                      onClick={() => archiveMut.mutate(v.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                    </button>
                  </div>
                </div>

                {healthByVariant.get(v.id) ? (
                  <div className="border-t border-border pt-4">
                    <ResumeHealthBlock
                      entry={healthByVariant.get(v.id)}
                      pendingKey={pendingHealthKey}
                      onSetState={(finding, next) =>
                        healthMut.mutate({ variantId: v.id, key: finding.key, state: next })
                      }
                    />
                  </div>
                ) : null}

                <ApplicationsDrilldown rows={breakdown[v.id] ?? []} />
              </article>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Resumes;
