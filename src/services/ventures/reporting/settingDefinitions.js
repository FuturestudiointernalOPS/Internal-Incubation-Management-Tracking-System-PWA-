/**
 * VENTURE REPORTING — every editable number, in one place.
 *
 * Three families, one table (`venture_stage_settings`), one screen:
 *   • STAGE_SETTINGS        — the entry criteria of §4.5
 *   • TRAFFIC_LIGHT_SETTINGS — the health bands of §11
 *   • SCHEDULE_SETTINGS     — WHEN a month/quarter is due
 *
 * The engine and the settings screen both read these definitions, so a
 * threshold cannot exist in one and be invisible in the other.
 *
 * `min`/`max` are sanity bounds, not policy: they stop a typo (a due day of
 * 400, a negative retention) without second-guessing the studio's judgement.
 */

// ── Stage entry criteria (§4.5) ────────────────────────────────────────────
export const STAGE_SETTINGS = [
  { key: "consecutive_months_required", group: "stage", labelKey: "venture.reporting.settings.consecutiveMonths", min: 1, max: 24, fallback: 3 },
  { key: "min_customer_growth_monthly", group: "stage", labelKey: "venture.reporting.settings.minGrowth", min: 0, max: 100, fallback: 5 },
  { key: "min_monthly_retention_early_traction", group: "stage", labelKey: "venture.reporting.settings.retentionEarly", min: 0, max: 100, fallback: 50 },
  { key: "min_monthly_retention_growth", group: "stage", labelKey: "venture.reporting.settings.retentionGrowth", min: 0, max: 100, fallback: 50 },
  { key: "min_ltv_cac", group: "stage", labelKey: "venture.reporting.settings.minLtvCac", min: 0, max: 100, fallback: 3 },
  { key: "validation_min_interviews", group: "stage", labelKey: "venture.reporting.settings.minInterviews", min: 0, max: 10000, fallback: 10 },
  { key: "early_traction_min_paying_customers", group: "stage", labelKey: "venture.reporting.settings.minCustomersEarly", min: 0, max: 100000, fallback: 5 },
  { key: "growth_min_paying_customers", group: "stage", labelKey: "venture.reporting.settings.minCustomersGrowth", min: 0, max: 100000, fallback: 15 },
  { key: "scaling_sustained_growth_months", group: "stage", labelKey: "venture.reporting.settings.scalingMonths", min: 1, max: 36, fallback: 6 },
  { key: "scaling_min_monthly_retention", group: "stage", labelKey: "venture.reporting.settings.scalingRetention", min: 0, max: 100, fallback: 70 },
  { key: "scaling_min_non_founder_fte", group: "stage", labelKey: "venture.reporting.settings.scalingFte", min: 0, max: 10000, fallback: 5 },
  { key: "review_flag_months", group: "stage", labelKey: "venture.reporting.settings.reviewMonths", min: 1, max: 24, fallback: 3 },
];

// ── Traffic light (§11) ────────────────────────────────────────────────────
export const TRAFFIC_LIGHT_SETTINGS = [
  { key: "traffic_runway_green_months", group: "traffic", labelKey: "venture.reporting.settings.runwayGreen", min: 0, max: 60, fallback: 9 },
  { key: "traffic_runway_amber_months", group: "traffic", labelKey: "venture.reporting.settings.runwayAmber", min: 0, max: 60, fallback: 4 },
  { key: "traffic_growth_green_pct", group: "traffic", labelKey: "venture.reporting.settings.growthGreen", min: 0, max: 100, fallback: 5 },
  { key: "traffic_growth_amber_pct", group: "traffic", labelKey: "venture.reporting.settings.growthAmber", min: -100, max: 100, fallback: 0 },
  { key: "traffic_milestones_green_pct", group: "traffic", labelKey: "venture.reporting.settings.milestonesGreen", min: 0, max: 100, fallback: 80 },
  { key: "traffic_milestones_amber_pct", group: "traffic", labelKey: "venture.reporting.settings.milestonesAmber", min: 0, max: 100, fallback: 50 },
];

// ── The business reading (the studio's verdict and risk panel) ─────────────
// These four decide how the Super Admin's Reports page READS a month. They
// used to be literals in `analysisModel.js`, which meant a studio could move
// the traffic light's bar in settings and leave the verdict quoting the old
// number. They live here so the screen and the engine share one threshold.
// Percentages are stored as PERCENT (5 = 5%), matching the traffic light.
export const READING_SETTINGS = [
  { key: "reading_growth_green_pct", group: "reading", labelKey: "venture.reporting.settings.readingGrowthGreen", min: -100, max: 100, fallback: 5 },
  { key: "reading_growth_red_pct", group: "reading", labelKey: "venture.reporting.settings.readingGrowthRed", min: -100, max: 100, fallback: -2 },
  { key: "reading_retention_floor_pct", group: "reading", labelKey: "venture.reporting.settings.readingRetentionFloor", min: 0, max: 100, fallback: 50 },
  { key: "reading_min_ltv_cac", group: "reading", labelKey: "venture.reporting.settings.readingMinLtvCac", min: 0, max: 100, fallback: 3 },
];

// ── Reporting schedule ─────────────────────────────────────────────────────
export const SCHEDULE_SETTINGS = [
  { key: "reporting_monthly_due_day", group: "schedule", labelKey: "venture.reporting.settings.monthlyDueDay", min: 1, max: 31, fallback: 5 },
  { key: "reporting_monthly_due_minute", group: "schedule", labelKey: "venture.reporting.settings.monthlyDueMinute", min: 0, max: 1439, fallback: 540 },
  { key: "reporting_quarterly_due_day", group: "schedule", labelKey: "venture.reporting.settings.quarterlyDueDay", min: 1, max: 31, fallback: 10 },
  { key: "reporting_quarterly_due_minute", group: "schedule", labelKey: "venture.reporting.settings.quarterlyDueMinute", min: 0, max: 1439, fallback: 540 },
  { key: "reporting_utc_offset_minutes", group: "schedule", labelKey: "venture.reporting.settings.utcOffset", min: -720, max: 840, fallback: 0 },
];

export const SETTING_GROUPS = [
  { key: "stage", labelKey: "venture.reporting.settings.groupStage", items: STAGE_SETTINGS },
  { key: "traffic", labelKey: "venture.reporting.settings.groupTraffic", items: TRAFFIC_LIGHT_SETTINGS },
  { key: "reading", labelKey: "venture.reporting.settings.groupReading", items: READING_SETTINGS },
  { key: "schedule", labelKey: "venture.reporting.settings.groupSchedule", items: SCHEDULE_SETTINGS },
];

export const ALL_SETTINGS = [
  ...STAGE_SETTINGS,
  ...TRAFFIC_LIGHT_SETTINGS,
  ...READING_SETTINGS,
  ...SCHEDULE_SETTINGS,
];

export function definitionFor(key) {
  return ALL_SETTINGS.find((item) => item.key === key) || null;
}

export function isEditableKey(key) {
  return Boolean(definitionFor(key));
}

/**
 * The threshold for one key. A missing or unusable value falls back to the
 * spec's own number rather than to 0 — a zero threshold would pass everything.
 */
export function settingValue(settings, key) {
  const definition = definitionFor(key);
  const parsed = Number(settings?.[key]);
  return Number.isFinite(parsed) ? parsed : definition?.fallback ?? 0;
}

/** Validate one setting against its declared range. Returns an i18n key or null. */
export function validateSettingValue(key, value) {
  const definition = definitionFor(key);
  if (!definition) return "venture.reporting.settings.validation.unknown";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "venture.reporting.settings.validation.number";
  if (parsed < definition.min || parsed > definition.max) {
    return "venture.reporting.settings.validation.range";
  }
  return null;
}
