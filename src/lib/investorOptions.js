/**
 * INVESTOR OPTIONS — the ONE list of investor-facing enumerations (pure).
 *
 * Before this module the same three dropdowns existed in three places with two
 * different country lists: the application seed carried 13 countries, while the
 * discovery filters and the investor profile carried 10. An investor who picked
 * Senegal, Côte d'Ivoire or Cameroon on an application was recorded correctly but
 * could neither filter on them nor keep them through a profile save.
 *
 * The VALUES are the stored ones (they go into `investor_preferences.*`,
 * `business_stage` and the form submission). The LABELS are resolved through
 * i18n at render time, so French and English share one source:
 *
 *   <button>{t(industryLabelKey(value))}</button>
 *
 * Nothing here is hard-coded twice, and no React/Next/database import lives here.
 */

// ─── Values (what is stored) ─────────────────────────────────────────────────

export const INVESTOR_INDUSTRIES = [
  "FinTech",
  "HealthTech",
  "AgriTech",
  "EdTech",
  "CleanTech",
  "Logistics",
  "E-Commerce",
  "SaaS",
  "AI/ML",
  "Renewable Energy",
];

/**
 * Investor-preference stages. Deliberately NOT the venture `business_stage`
 * vocabulary (idea/validation/early_traction/growth/scaling): this is what an
 * investor says they back, and what `investor_preferences.startup_stages` holds.
 */
export const INVESTOR_STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Growth"];

/**
 * ISO-3166 alpha-2 codes, stored as codes. The union of the application seed and
 * the discovery filters — the drift is closed here.
 */
export const INVESTOR_COUNTRIES = [
  "CD",
  "KE",
  "NG",
  "ZA",
  "GH",
  "RW",
  "UG",
  "TZ",
  "EG",
  "MA",
  "SN",
  "CI",
  "CM",
];

/**
 * `investor_profiles.investor_type` values. `other` is accompanied by
 * `investor_type_other` (free text) on the profile.
 */
export const INVESTOR_TYPES = [
  "angel",
  "venture_fund",
  "family_office",
  "corporate",
  "dfi",
  "foundation",
  "accelerator",
  "other",
];

// ─── Option objects ({ value, labelKey }) ────────────────────────────────────

/** A stable slug for a stored value: "Pre-Seed" → "pre_seed", "AI/ML" → "ai_ml". */
export function investorOptionSlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** The i18n key for one option: ("countries", "CD") → "investorOptions.countries.cd". */
export function investorOptionLabelKey(kind, value) {
  return `investorOptions.${kind}.${investorOptionSlug(value)}`;
}

export const industryLabelKey = (value) => investorOptionLabelKey("industries", value);
export const stageLabelKey = (value) => investorOptionLabelKey("stages", value);
export const countryLabelKey = (value) => investorOptionLabelKey("countries", value);
export const investorTypeLabelKey = (value) => investorOptionLabelKey("types", value);

const toOptions = (values, labelKey) =>
  values.map((value) => ({ value, labelKey: labelKey(value) }));

export const INDUSTRY_OPTIONS = toOptions(INVESTOR_INDUSTRIES, industryLabelKey);
export const STAGE_OPTIONS = toOptions(INVESTOR_STAGES, stageLabelKey);
export const COUNTRY_OPTIONS = toOptions(INVESTOR_COUNTRIES, countryLabelKey);
export const INVESTOR_TYPE_OPTIONS = toOptions(INVESTOR_TYPES, investorTypeLabelKey);

/** The label for a stored value, translated; falls back to the raw value. */
export function investorOptionLabel(t, kind, value) {
  const key = investorOptionLabelKey(kind, value);
  const label = t(key);
  return label === key ? String(value ?? "") : label;
}
