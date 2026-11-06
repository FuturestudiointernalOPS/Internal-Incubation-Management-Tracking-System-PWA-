// An allowlist, not a list of today's internal columns: future private columns
// must not become visible merely because a model uses SELECT/RETURNING *.
const PROFILE_FIELDS = Object.freeze([
  "id", "user_id", "approval_status", "organization_name", "biography",
  "website", "linkedin", "photo_url", "created_at", "updated_at",
  "industries", "countries", "startup_stages", "ticket_size_min",
  "ticket_size_max", "investment_philosophy", "investment_experience",
  "visibility_mode", "investor_type", "investor_type_other", "language",
  "preferred_language", "logo_url", "past_investments",
  "nda_accepted_at", "nda_version", "terms_accepted_at", "terms_version",
  "onboarding_completed_at",
]);
const PROFILE_ARRAY_FIELDS = new Set(["industries", "countries", "startup_stages"]);

/** Return an own-profile DTO containing no review or compliance internals. */
export function toInvestorSelfProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
  const dto = {};
  for (const key of PROFILE_FIELDS) {
    if (!Object.hasOwn(profile, key)) continue;
    const value = profile[key];
    if (PROFILE_ARRAY_FIELDS.has(key)) {
      dto[key] = Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
    } else if (value instanceof Date) {
      dto[key] = Number.isFinite(value.getTime()) ? value.toISOString() : null;
    } else if (value === null || ["string", "boolean"].includes(typeof value)) {
      dto[key] = value;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      dto[key] = value;
    }
    // Nested objects are deliberately never copied from an unrestricted row.
  }
  return dto;
}

export function protectInvestorProfile(profile, enabled) {
  return enabled ? toInvestorSelfProfile(profile) : profile;
}
