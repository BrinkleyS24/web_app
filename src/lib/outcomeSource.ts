import type { WeeklyHighlightEmail } from "@/lib/emails";

/**
 * Who an email is from, for a list row: the employer, else the role, else the email's own subject
 * line in quotes. Never "Unknown company" — the recruiter meeting the founder's summary showed that
 * way (2026-09-25) had no company to find, but its subject said exactly which conversation it was.
 */
export function describeOutcomeSource(item: Pick<WeeklyHighlightEmail, "company" | "position" | "subject">) {
  if (item.company) return { primary: item.company, secondary: item.position || null };
  if (item.position) return { primary: item.position, secondary: null };
  return { primary: item.subject ? `“${item.subject}”` : "An email with no company named", secondary: null };
}
