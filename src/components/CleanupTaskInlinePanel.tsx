import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Link2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatEmailDate,
  getEmailCategoryLabel,
  getEmailCompany,
  getEmailTitle,
} from "@/lib/emailFormatting";
import {
  linkRoleEmails,
  type StoredEmail,
  updateEmailCompany,
  updateEmailPosition,
} from "@/lib/emails";
import {
  getCleanupStructuredCandidates,
  getCleanupUnlinkedCandidates,
  type QueueItem,
} from "@/lib/premiumTaskQueue";

const MAX_VISIBLE_ROWS = 5;

type CleanupTaskInlinePanelProps = {
  task: QueueItem;
  storedEmails: StoredEmail[];
  onRefresh: () => Promise<unknown>;
};

type DraftMap = Record<string, { company: string; position: string }>;

function buildInitialDrafts(emails: StoredEmail[]): DraftMap {
  return Object.fromEntries(
    emails.map((email) => [
      String(email.id),
      {
        company: String(email.company_name || "").trim(),
        position: String(email.position || "").trim(),
      },
    ]),
  );
}

function hasEnoughSignal(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (["unknown", "unknown company", "unknown position", "n/a", "na", "none", "null"].includes(normalized)) {
    return false;
  }
  return normalized.replace(/[^a-z0-9]/g, "").length >= 2;
}

function hasLinkableFields(email: StoredEmail) {
  const company = String(email.company_name || "").trim();
  const position = String(email.position || "").trim();
  return hasEnoughSignal(company) && hasEnoughSignal(position);
}

function RowMeta({ email }: { email: StoredEmail }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span>{getEmailCategoryLabel(email)}</span>
      <span>{formatEmailDate(email.date) || "Recent"}</span>
      {email.applicationId ? <span>Linked</span> : <span>Unlinked</span>}
    </div>
  );
}

export function CleanupTaskInlinePanel({ task, storedEmails, onRefresh }: CleanupTaskInlinePanelProps) {
  const isStructuredTask = task.actionType === "cleanup_structured_fields";
  const candidates = useMemo(
    () =>
      isStructuredTask
        ? getCleanupStructuredCandidates(storedEmails)
        : getCleanupUnlinkedCandidates(storedEmails),
    [isStructuredTask, storedEmails],
  );
  const visibleCandidates = useMemo(() => candidates.slice(0, MAX_VISIBLE_ROWS), [candidates]);
  const [drafts, setDrafts] = useState<DraftMap>(() => buildInitialDrafts(visibleCandidates));
  const [busyKey, setBusyKey] = useState<string>("");

  useEffect(() => {
    setDrafts(buildInitialDrafts(visibleCandidates));
  }, [visibleCandidates]);

  async function handleStructuredSave(email: StoredEmail) {
    const emailKey = String(email.id);
    const draft = drafts[emailKey] || {
      company: String(email.company_name || "").trim(),
      position: String(email.position || "").trim(),
    };
    const nextCompany = draft.company.trim();
    const nextPosition = draft.position.trim();
    const currentCompany = String(email.company_name || "").trim();
    const currentPosition = String(email.position || "").trim();
    const companyChanged = nextCompany.length > 0 && nextCompany !== currentCompany;
    const positionChanged = nextPosition.length > 0 && nextPosition !== currentPosition;

    if (!companyChanged && !positionChanged) {
      toast.message("No new field changes to save for this thread.");
      return;
    }

    setBusyKey(emailKey);

    try {
      if (companyChanged) {
        await updateEmailCompany({ emailId: email.id, companyName: nextCompany });
      }
      if (positionChanged) {
        await updateEmailPosition({ emailId: email.id, position: nextPosition });
      }
      if ((nextCompany || currentCompany) && (nextPosition || currentPosition)) {
        await linkRoleEmails({ emailId: email.id }).catch(() => undefined);
      }
      await onRefresh();
      toast.success("Thread details updated in place.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save thread details.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleLink(email: StoredEmail) {
    const emailKey = String(email.id);
    if (!hasLinkableFields(email)) {
      toast.error("This thread still needs a company and role before it can be linked.");
      return;
    }

    setBusyKey(emailKey);

    try {
      const result = await linkRoleEmails({ emailId: email.id });
      await onRefresh();
      const relinked = Number(result?.relinked || 0);
      toast.success(relinked > 1 ? `Linked ${relinked} related emails.` : "Application journey linked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to link this thread.");
    } finally {
      setBusyKey("");
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-success/20 bg-success/5 p-4 text-sm text-success">
        This cleanup task is already clear. The queue should drop it on the next refresh.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            Resolve in card
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing {visibleCandidates.length} of {candidates.length} affected threads so you can clear the obvious fixes without leaving the queue.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {visibleCandidates.map((email) => {
          const emailKey = String(email.id);
          const draft = drafts[emailKey] || {
            company: String(email.company_name || "").trim(),
            position: String(email.position || "").trim(),
          };
          const rowBusy = busyKey === emailKey;

          if (isStructuredTask) {
            return (
              <div key={emailKey} className="rounded-xl border border-border/70 bg-background/80 p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{getEmailTitle(email)}</p>
                  <p className="text-sm text-muted-foreground">{email.subject || "Untitled thread"}</p>
                  <RowMeta email={email} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={draft.company}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDrafts((current) => ({
                        ...current,
                        [emailKey]: {
                          ...(current[emailKey] || draft),
                          company: value,
                        },
                      }));
                    }}
                    placeholder="Company"
                    disabled={rowBusy}
                  />
                  <Input
                    value={draft.position}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDrafts((current) => ({
                        ...current,
                        [emailKey]: {
                          ...(current[emailKey] || draft),
                          position: value,
                        },
                      }));
                    }}
                    placeholder="Role / title"
                    disabled={rowBusy}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" disabled={rowBusy} onClick={() => handleStructuredSave(email)}>
                    {rowBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Save and relink
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Saves only changed values and re-checks the application journey.
                  </span>
                </div>
              </div>
            );
          }

          const canLink = hasLinkableFields(email);

          return (
            <div key={emailKey} className="rounded-xl border border-border/70 bg-background/80 p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{getEmailTitle(email)}</p>
                <p className="text-sm text-muted-foreground">{getEmailCompany(email)}</p>
                <p className="text-sm text-muted-foreground">{email.subject || "Untitled thread"}</p>
                <RowMeta email={email} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={rowBusy || !canLink} onClick={() => handleLink(email)}>
                  {rowBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  Link journey
                </Button>
                <span className="text-xs text-muted-foreground">
                  {canLink
                    ? "Rebuilds the application chain for matching company and role emails."
                    : "This thread still needs company and role data before it can be linked."}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {candidates.length > visibleCandidates.length ? (
        <p className="text-xs text-muted-foreground">
          More threads remain after these. Clear the visible rows first and the card will refresh with the next batch.
        </p>
      ) : null}
    </div>
  );
}
