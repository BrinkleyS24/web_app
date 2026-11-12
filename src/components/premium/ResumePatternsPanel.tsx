import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { EmptyState, Panel, ToneChip } from "./PremiumUI";
import { BUTTON } from "./tone";
import type { ResumeGap, ResumeGapInsightsResponse } from "@/lib/emails";
import { resumePatternSummary } from "@/lib/strategyPresentation";

function RequirementRows({ gaps }: { gaps: ResumeGap[] }) {
  return <ul className="divide-y divide-border">{gaps.map(gap => <li key={`${gap.category}-${gap.skill}`} className="min-w-0 py-4 first:pt-0 last:pb-0 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h3 className="min-w-0 text-[15px] font-semibold">{gap.skill}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <ToneChip tone={gap.category === "preferred" ? "neutral" : "attention"}>{gap.category === "required" ? "Requirement blocker" : gap.category === "evidence" ? "Review requirement" : "Nice to have"}</ToneChip>
        <span className="text-xs text-muted-foreground">{gap.occurrences} roles</span>
      </div>
    </div>
    {gap.label ? <p className="mt-1 text-sm text-muted-foreground">{gap.label}</p> : null}
    <details className="mt-1 text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">See posting evidence</summary>
      {gap.examples.length ? <>
        <p className="text-muted-foreground">{gap.examples.map(example => [example.company, example.position].filter(Boolean).join(" · ")).filter(Boolean).slice(0, 3).join("; ")}</p>
        {gap.occurrences > Math.min(gap.examples.length, 3) ? <p className="mt-1 text-xs text-muted-foreground">Showing {Math.min(gap.examples.length, 3)} of {gap.occurrences} checked roles.</p> : null}
        <ul className="mt-2 space-y-3">{gap.examples.map((example, index) => <li key={`${example.verdictId || "unknown"}-${index}`}>
          {example.verdictId ? <Link to={`/apply-gate?verdict=${encodeURIComponent(example.verdictId)}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-2">{[example.company, example.position].filter(Boolean).join(" · ") || "View saved check"}</Link>
            : <p className="font-medium">{[example.company, example.position].filter(Boolean).join(" · ") || "Source identity unavailable"}</p>}
          {example.requirementQuote ? <blockquote className="mt-1 border-l-2 border-border pl-3 text-muted-foreground">{example.requirementQuote}</blockquote> : <p className="mt-1 text-muted-foreground">No requirement quote is available in this summary.</p>}
        </li>)}</ul>
      </> : <p className="text-muted-foreground">No source examples are available in this summary. Review the current posting in Apply Gate.</p>}
    </details>
  </li>)}</ul>;
}

export function ResumePatternsPanel({ data }: { data: ResumeGapInsightsResponse }) {
  const summary = resumePatternSummary(data);
  return <Panel icon={FileText} tone="brand" title="Requirements across role checks" bodyClassName="min-w-0 [overflow-wrap:anywhere]">
    {data.resume ? <p className="mb-3 text-sm text-muted-foreground">Using <strong>{data.resume.name}</strong>, your default resume · {data.distinctRolesEvaluated} current {data.distinctRolesEvaluated === 1 ? "role check" : "role checks"}. <Link className="font-medium underline" to={`/resumes#resume-${encodeURIComponent(data.resume.variantId)}`}>View or change your resume</Link>.</p> : null}
    {data.truncated ? <p className="mb-3 text-sm text-muted-foreground">Based on the latest {data.sampledChecks} saved checks; older checks are outside this sample.</p> : null}
    {data.gaps.length ? <>
      <p className="mb-4 text-sm text-muted-foreground">These requirements appeared in at least two checked roles. Review the posting evidence; missing resume evidence does not prove that you lack a qualification.</p>
      <RequirementRows gaps={data.gaps.slice(0, 3)} />
      {data.gaps.length > 3 ? <details className="mt-4 border-t border-border pt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">More repeated requirements ({data.gaps.length - 3})</summary><RequirementRows gaps={data.gaps.slice(3)} /></details> : null}
    </> : <EmptyState compact title={summary.title} body={summary.body} action={<Link to={summary.href} className={BUTTON.secondary}>{summary.action}</Link>} />}
    <details className="mt-4 border-t border-border pt-2 text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">What this summary uses</summary>
      <div className="space-y-2 text-muted-foreground">
        <p>A requirement needs to appear in two distinct roles checked against this exact saved wording. Other resume versions are kept separate. A repeated check of one role does not increase its count.</p>
        {(data.outdatedVerdictsExcluded || 0) > 0 ? <p>{data.outdatedVerdictsExcluded} older {data.outdatedVerdictsExcluded === 1 ? "check was" : "checks were"} excluded because the analysis needs updating.</p> : null}
        {(data.changedResumeVerdictsExcluded || 0) > 0 ? <p>{data.changedResumeVerdictsExcluded} {data.changedResumeVerdictsExcluded === 1 ? "check used" : "checks used"} earlier resume wording and {data.changedResumeVerdictsExcluded === 1 ? "was" : "were"} excluded.</p> : null}
        {(data.otherResumeVerdictsExcluded || 0) > 0 ? <p>{data.otherResumeVerdictsExcluded} checks for other resume versions are kept separate.</p> : null}
        {data.truncated ? <p>This summary uses the latest {data.sampledChecks} saved checks; older checks are outside this sample.</p> : null}
        <p>You can check a relevant current posting in Apply Gate; you do not need to recheck every older job.</p>
      </div>
    </details>
  </Panel>;
}
