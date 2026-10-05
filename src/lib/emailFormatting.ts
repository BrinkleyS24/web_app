import type { StoredEmail } from "@/lib/emails";
import { parseApiDate } from "@/lib/apiDate";

export function getEmailCompany(email: StoredEmail) {
  return email.company_name || "Unknown company";
}

export function getEmailTitle(email: StoredEmail) {
  return email.position || email.subject || "Untitled role";
}

export function getEmailCategoryLabel(email: StoredEmail) {
  const raw = (email.category || "").toString().toLowerCase();
  if (!raw) return "Unknown";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatEmailDate(dateValue?: string | null) {
  if (!dateValue) return "";
  const date = parseApiDate(dateValue);
  if (!date) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
