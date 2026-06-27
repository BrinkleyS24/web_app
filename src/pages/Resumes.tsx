import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Check, FileText, Loader2, Plus, Star, Trash2 } from "lucide-react";
import {
  fetchResumeVariants,
  fetchVariantScoreboard,
  createResumeVariant,
  setDefaultResumeVariant,
  archiveResumeVariant,
  type VariantScoreRow,
} from "@/lib/emails";

function roundedChars(n: number) {
  return `${Math.round(n / 100) * 100}+ chars`;
}

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

const Resumes = () => {
  const queryClient = useQueryClient();
  const variantsQuery = useQuery({ queryKey: ["resume-variants"], queryFn: fetchResumeVariants });
  const scoreboardQuery = useQuery({ queryKey: ["variant-scoreboard"], queryFn: () => fetchVariantScoreboard() });

  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draft, setDraft] = useState("");

  const variants = variantsQuery.data?.variants ?? [];
  const scoreByVariant = new Map(
    (scoreboardQuery.data?.scoreboard?.perVariant ?? []).map((r) => [r.variantId, r]),
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["resume-variants"] });
    queryClient.invalidateQueries({ queryKey: ["variant-scoreboard"] });
  };
  const createMut = useMutation({
    mutationFn: createResumeVariant,
    onSuccess: () => { setDraft(""); setDraftName(""); setAdding(false); invalidate(); },
  });
  const setDefaultMut = useMutation({ mutationFn: setDefaultResumeVariant, onSuccess: invalidate });
  const archiveMut = useMutation({ mutationFn: archiveResumeVariant, onSuccess: invalidate });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Your résumé library
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.025em] text-foreground">Résumés</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Save the versions you tailor, then see which one actually gets interviews — and which gets auto-rejected.
          </p>
        </div>

        {variantsQuery.isLoading ? (
          <div className="glass-card flex items-center gap-2 rounded-xl px-5 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your résumés…
          </div>
        ) : (
          <div className="space-y-3">
            {variants.map((v) => (
              <div key={v.id} className="glass-card space-y-2 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold text-foreground">{v.name}</span>
                    {v.isDefault ? (
                      <span className="rounded border border-accent/20 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                        Default
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">({roundedChars(v.charCount)})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!v.isDefault ? (
                      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setDefaultMut.mutate(v.id)}>
                        <Star className="h-3 w-3" /> Make default
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={() => archiveMut.mutate(v.id)}
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{recordLine(scoreByVariant.get(v.id))}</p>
              </div>
            ))}
            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No résumés saved yet. Add the version you send most so Apply Gate can start learning what converts.
              </p>
            ) : null}
          </div>
        )}

        {adding ? (
          <div className="glass-card space-y-3 rounded-xl p-4">
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Name (e.g., QA-focused)"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <textarea
              rows={10}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Paste your résumé text here… (plain text, not a file)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                disabled={draft.trim().length < 20 || createMut.isPending}
                onClick={() => createMut.mutate({ name: draftName.trim() || "My résumé", text: draft })}
              >
                {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add a résumé variant
          </Button>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Resumes;
