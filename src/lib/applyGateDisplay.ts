const KNOWN_COMPANIES: Record<string, string> = {
  citadelsecurities: "Citadel Securities",
  goldmansachs: "Goldman Sachs",
  spotandtango: "Spot & Tango",
  rockstargames: "Rockstar Games",
};

export function normalizeCompanyName(rawValue: string | null | undefined) {
  const value = String(rawValue || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return null;

  const lowered = value.toLowerCase();
  if (lowered === "company unavailable" || lowered === "unknown company") {
    return null;
  }

  return value;
}

export function companyFromUrl(rawUrl: string | null | undefined) {
  if (!rawUrl || !rawUrl.trim()) return null;

  try {
    const hostname = new URL(rawUrl.trim()).hostname.replace(/^www\./i, "");
    const root = (hostname.split(".")[0] || "").toLowerCase();
    if (!root) return null;
    if (KNOWN_COMPANIES[root]) return KNOWN_COMPANIES[root];

    const inferred = root
      .replace(/[-_]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");

    return inferred || null;
  } catch {
    return null;
  }
}

export function splitRoleAndCompany(
  rawTitle: string | null | undefined,
  explicitCompany?: string | null,
  fallbackUrl?: string | null,
) {
  const title = String(rawTitle || "").trim();
  const preferredCompany = normalizeCompanyName(explicitCompany);

  if (!title) {
    return {
      role: "Current Job Analysis",
      company: preferredCompany || companyFromUrl(fallbackUrl) || null,
    };
  }

  const separators = [" at ", " @ ", " - ", " | ", " — ", " – "];
  for (const separator of separators) {
    if (!title.includes(separator)) continue;
    const parts = title.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        role: parts[0],
        company: preferredCompany || normalizeCompanyName(parts.slice(1).join(" ")) || companyFromUrl(fallbackUrl) || null,
      };
    }
  }

  return {
    role: title,
    company: preferredCompany || companyFromUrl(fallbackUrl) || null,
  };
}
