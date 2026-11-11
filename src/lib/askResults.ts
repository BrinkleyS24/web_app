import type { AskApplication, AskListItem, AskNextStep, AskResponse, AskStage } from "./ask";

export const ASK_RESULTS_PAGE_SIZE = 5;
export const ASK_STAGE_LABELS: Record<AskStage, string> = {
  waiting: "Waiting on a reply", quiet: "Went quiet", interviewing: "Still interviewing",
  interview_quiet: "No word since the interview", offer: "Offer", rejected: "Rejected", closed: "Closed by you",
};
export const ASK_STEP_LABELS: Record<AskNextStep, string> = {
  research: "Research the company", find_contact: "Find someone to contact", follow_up: "Time to follow up",
  final_check: "Final check-in", thank_you: "Send a thank-you", interview_follow_up: "Follow up on the interview",
  status_check: "Ask for a status update", complete_assessment: "Finish the assessment", prepare_interview: "Prepare for the interview",
};

export type AskResultRow = AskListItem & { citation?: AskApplication };

/** Never join by employer/title: one employer can have several different applications. */
export function askResultRows(result: AskResponse): AskResultRow[] {
  const citations = new Map(result.applications.map(app => [app.ref, app]));
  const rows = result.list?.items.map(item => ({ ...item, citation: citations.get(item.ref) })) || [];
  const seen = new Set(rows.map(row => row.ref));
  // A compound answer can cite other applications beyond the first structured list.
  for (const app of result.applications) if (!seen.has(app.ref)) { rows.push({ ...app, citation: app }); seen.add(app.ref); }
  return rows;
}

export function askDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function orderAskRows(rows: AskResultRow[], search: string, order: string, kind?: string): AskResultRow[] {
  const query = search.trim().toLocaleLowerCase();
  const dateValue = (row: AskResultRow) => {
    const date = kind === "reached_interview" ? row.interviewedOn : row.lastUpdateOn || row.appliedOn || row.citation?.lastUpdateOn;
    return date && askDate(date) ? Date.parse(date) : -Infinity;
  };
  return rows.map((row, index) => ({ row, index }))
    .filter(({ row }) => !query || `${row.company} ${row.role || ""}`.toLocaleLowerCase().includes(query))
    .sort((a, b) => {
      let difference = 0;
      if (order === "recent") difference = dateValue(b.row) - dateValue(a.row);
      if (order === "longest") difference = (b.row.daysSinceLastUpdate ?? -1) - (a.row.daysSinceLastUpdate ?? -1);
      // Both missing dates yield NaN. Preserve server order for unknowns/ties.
      return (Number.isFinite(difference) ? difference : difference === Infinity ? 1 : difference === -Infinity ? -1 : 0) || a.index - b.index;
    }).map(({ row }) => row);
}
