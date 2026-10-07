import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext.jsx";
import { readActionContext } from "@/lib/actionWorkspace";
import { completeQueueAction } from "@/lib/emails";
import { useWorkspaceAction } from "@/hooks/useWorkspaceAction";
import { BUTTON, CARD, EYEBROW } from "./tone";
import { cn } from "@/lib/utils";

export function ActionWorkspaceBanner() {
  const location = useLocation();
  const { user } = useAuth();
  const context = readActionContext(location.search);
  if (!user || !["/apply-gate", "/resumes"].includes(location.pathname)
    || !new URLSearchParams(location.search).has("action")) return null;
  if (!context) return <section className={cn(CARD, "mb-5 p-4")} aria-label="Action context">
    <p>This action link is incomplete. Open the task again from Next Actions.</p>
    <Link to="/next-actions" className={cn(BUTTON.secondary, "mt-3")}>Back to Next Actions</Link>
  </section>;
  return <ResolvedActionContext key={`${user.uid}:${context.logicalKey}:${context.dedupeKey}`} {...context} ownerId={user.uid} />;
}

function ResolvedActionContext({ logicalKey, dedupeKey, ownerId }: { logicalKey: string; dedupeKey: string; ownerId: string }) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const { queue, action } = useWorkspaceAction(logicalKey, ownerId);
  const status = action?.effectiveStatus || action?.status;
  const changed = action && action.dedupeKey !== dedupeKey;
  const done = saved || status === "done" && !changed;
  const canComplete = Boolean(action && !changed && status === "open" && !queue.isError && !queue.isFetching && !done);
  const returnHref = action ? `/next-actions#${encodeURIComponent(action.id)}` : "/next-actions";

  async function complete() {
    if (!canComplete || submitting.current) return;
    submitting.current = true; setPending(true); setError("");
    try {
      const result = await completeQueueAction({ logicalKey, dedupeKey });
      if (!result.success || result.state !== "completed") throw new Error("The task was not confirmed as saved. Retry or review it in Next Actions.");
      setSaved(true);
      // A failed refresh cannot undo a confirmed write or turn it into a failed-save message.
      void Promise.all([
        client.invalidateQueries({ queryKey: ["fix-suggestions", "queue"] }),
        client.invalidateQueries({ queryKey: ["dashboard", "queue"] }),
      ]).catch(() => {});
    } catch {
      setError("That did not confirm a save. The task may have changed. Retry loading it or review Next Actions before trying again.");
    } finally { submitting.current = false; setPending(false); }
  }

  return <section className={cn(CARD, "mb-5 space-y-3 p-4 sm:p-5 [overflow-wrap:anywhere]")} aria-label="Action context">
    <p className={EYEBROW}>Working on your next action</p>
    {done ? <p role="status" className="font-semibold">Task marked done. Opening this tool did not record an application or send an email.</p>
      : queue.isPending ? <p role="status">Loading the job and task you opened…</p>
      : queue.isError ? <p role="alert">Your action could not be loaded. Your work here remains available.</p>
      : !action ? <p>This task is no longer available. Review Next Actions for the current list.</p>
      : changed ? <p>This task changed after you opened it. Review its current evidence in Next Actions before marking it done.</p>
      : <>
        <h2 className="text-base font-semibold">{action.title}</h2>
        {[action.company, action.roleTitle].filter(Boolean).length > 0 && <p className="text-sm">{[action.company, action.roleTitle].filter(Boolean).join(" · ")}</p>}
        <p className="text-sm text-muted-foreground">{action.whyNow || action.targetOutcome}</p>
        {action.evidence?.length ? <details><summary className="cursor-pointer text-sm font-medium">Evidence for this task</summary>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{action.evidence.slice(0, 4).map((line, index) => <li key={index}>{line}</li>)}</ul>
        </details> : null}
        {status !== "open" ? <p className="text-sm">This task is {status || "unavailable"}. Review it in Next Actions.</p>
          : <p className="text-sm text-muted-foreground">When you finish this task, mark it done here. This records your progress, not an application submission.</p>}
      </>}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <div className="flex flex-wrap gap-2">
      <Link to={returnHref} className={BUTTON.secondary}>Back to Next Actions</Link>
      {canComplete || pending ? <button type="button" className={BUTTON.primary} disabled={!canComplete || pending} onClick={() => void complete()}>{pending ? "Saving…" : "I've finished this task"}</button> : null}
      {(queue.isError || error) && <button type="button" className={BUTTON.secondary} disabled={queue.isFetching || pending} onClick={() => { setError(""); void queue.refetch(); }}>Reload task</button>}
    </div>
  </section>;
}
