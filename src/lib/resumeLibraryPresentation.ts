import type { ResumeHealthEntry, ResumeVariant } from "./emails";
import { RESUME_ID } from "./resumeWorkspace";

const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;

export function requireSavedResumes(value: unknown): { success: true; variants: ResumeVariant[] } {
  if (!object(value) || value.success !== true || !Array.isArray(value.variants)
    || !value.variants.every(row => object(row) && text(row.id) && text(row.name) && typeof row.isDefault === "boolean"
      && (row.charCount === undefined || count(row.charCount)))
    || new Set(value.variants.map(row => row.id)).size !== value.variants.length
    || value.variants.filter(row => row.isDefault).length > 1) {
    throw new Error("Your saved versions could not be verified. Try loading the library again.");
  }
  return value as { success: true; variants: ResumeVariant[] };
}

export function requireResumeChecks(value: unknown): { success: true; resumes: ResumeHealthEntry[] } {
  if (!object(value) || value.success !== true || !Array.isArray(value.resumes)
    || !value.resumes.every(row => object(row) && (row.variantId === null || text(row.variantId)) && Array.isArray(row.findings)
      && (row.document === null || object(row.document) && row.document.variantId === row.variantId
        && text(row.document.fingerprint) && count(row.document.characters))
      && new Set(row.findings.map(finding => object(finding) ? finding.key : null)).size === row.findings.length
      && row.findings.every(finding => object(finding) && text(finding.key) && text(finding.title)
        && typeof finding.evidence === "string" && typeof finding.action === "string"
        && ["blocking", "important", "suggested"].includes(String(finding.severity)) && typeof finding.dismissed === "boolean"))
    || new Set(value.resumes.map(row => row.variantId)).size !== value.resumes.length) {
    throw new Error("The resume checks could not be verified. Your saved versions remain available.");
  }
  return value as { success: true; resumes: ResumeHealthEntry[] };
}

/** Preserve task context while opening exactly the version named in an outcome row. */
export function resumeLibraryHref(search: string, id: string) {
  const params = new URLSearchParams(search);
  params.set("view", "library");
  if (RESUME_ID.test(id)) params.set("resume", id);
  else params.delete("resume");
  return `/resumes?${params}#resume-${encodeURIComponent(id)}`;
}
