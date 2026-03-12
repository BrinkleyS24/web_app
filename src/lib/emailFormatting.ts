import type { StoredEmail } from "@/lib/emails";

export function getEmailCompany(email: StoredEmail) {
  return email.company_name_corrected || email.company_name || "Unknown company";
}

export function getEmailTitle(email: StoredEmail) {
  return email.position_corrected || email.position || email.subject || "Untitled role";
}

export function getEmailCategoryLabel(email: StoredEmail) {
  const raw = (email.category || "").toString().toLowerCase();
  if (!raw) return "Unknown";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatEmailDate(dateValue?: string | null) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
