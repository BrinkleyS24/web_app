import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Check,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchResume, deleteResume } from "@/lib/emails";
import { useSaveResume } from "@/hooks/useSaveResume";

/**
 * Shared resume prompt that sits above the analysis form on
 * Apply Gate, Pre-jection, and any future premium tool.
 *
 * States:
 *  - No resume saved → expanded textarea to paste
 *  - Resume saved → compact badge + expand/edit/delete
 */
export function ResumePrompt() {
  const queryClient = useQueryClient();

  // ── Fetch existing resume ──────────────────────────────────────
  const resumeQuery = useQuery({
    queryKey: ["user-resume"],
    queryFn: fetchResume,
    staleTime: 60_000,
  });

  const savedResume = resumeQuery.data?.resumeText ?? null;
  const hasSaved = Boolean(savedResume && savedResume.trim().length > 20);

  // ── Local state ────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");

  // Seed editor draft when we start editing
  useEffect(() => {
    if (editing && savedResume) setDraft(savedResume);
  }, [editing, savedResume]);

  // ── Save mutation (shared hook) ───────────────────────────────
  const saveMutation = useSaveResume();

  // ── Delete mutation ────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: deleteResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-resume"] });
      setDraft("");
      setEditing(false);
      setExpanded(false);
    },
  });

  const handleSave = useCallback(() => {
    if (draft.trim().length >= 20) {
      saveMutation.mutate(draft, { onSuccess: () => setEditing(false) });
    }
  }, [draft, saveMutation]);

  // ── Loading state ──────────────────────────────────────────────
  if (resumeQuery.isLoading) {
    return (
      <div className="glass-card rounded-xl px-5 py-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading profile…
      </div>
    );
  }

  // ── No resume yet → prompt to add ─────────────────────────────
  if (!hasSaved && !editing) {
    return (
      <div className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Add your resume for better results
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Right now we can only infer your skills from application history.
              Paste your resume text so Apply Gate and Pre-jection can compare
              against your actual experience.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setDraft("");
            setEditing(true);
          }}
        >
          <Pencil className="w-3.5 h-3.5" />
          Paste Resume
        </Button>
      </div>
    );
  }

  // ── Editing mode ───────────────────────────────────────────────
  if (editing) {
    return (
      <div className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">
            {hasSaved ? "Update Resume" : "Paste Your Resume"}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Copy-paste the text of your resume. We extract skills, seniority,
          certifications and industry experience from it.
        </p>
        <textarea
          rows={10}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
          placeholder="Paste your resume text here… (plain text, not a file)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={draft.trim().length < 20 || saveMutation.isPending}
            onClick={handleSave}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {saveMutation.isPending ? "Saving…" : "Save Resume"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
        {saveMutation.isError && (
          <p className="text-xs text-red-500">
            {(saveMutation.error as Error)?.message ?? "Failed to save."}
          </p>
        )}
      </div>
    );
  }

  // ── Resume saved → compact badge ──────────────────────────────
  const charCount = savedResume?.length ?? 0;
  const preview =
    savedResume && savedResume.length > 120
      ? savedResume.slice(0, 120).trim() + "…"
      : savedResume;

  return (
    <div className="glass-card rounded-xl px-5 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-foreground hover:text-accent transition-colors"
          onClick={() => setExpanded((e) => !e)}
        >
          <FileText className="w-4 h-4 text-emerald-500" />
          <span className="font-medium">Resume saved</span>
          <span className="text-xs text-muted-foreground">
            ({Math.round(charCount / 100) * 100}+ chars)
          </span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => {
              setDraft(savedResume || "");
              setEditing(true);
            }}
          >
            <Pencil className="w-3 h-3" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-red-500 hover:text-red-600"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            <Trash2 className="w-3 h-3" />
            Remove
          </Button>
        </div>
      </div>

      {expanded && preview && (
        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
          {preview}
        </p>
      )}
    </div>
  );
}
