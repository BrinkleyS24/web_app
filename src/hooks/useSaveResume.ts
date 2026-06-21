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
