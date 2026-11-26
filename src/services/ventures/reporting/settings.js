import { ensureVentureSchema } from "@/services/ventures/schema";
import {
  selectStageSettings,
  selectBands,
  selectGlossary,
  insertStageSetting,
  deleteStageSetting,
  upsertGlossaryTerm,
} from "@/models/ventureReportingStore";
import { buildSettingsMap, groupBands } from "./rules";
import {
  SETTING_GROUPS,
  ALL_SETTINGS,
  validateSettingValue,
  isEditableKey,
} from "./settingDefinitions";

/**
 * The business models a threshold may be overridden for. `default` is the base
 * every other model inherits, so it is always present and never removable.
 */
export const BUSINESS_MODELS = [
  "default",
  "subscription",
  "transactional",
  "marketplace",
  "services",
  "other",
];

/**
 * The reporting tables are additive and live in `ensureVentureSchema`. This
 * helper initialises them once per process; repeated calls are cheap because
 * the db layer skips already-applied maintenance DDL.
 */
let schemaReady = null;
export function ensureReportingSchema() {
  if (!schemaReady) {
    schemaReady = ensureVentureSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

/** Thresholds (override applied where a business model is given) + bands + glossary. */
export async function getReportingSettings({ businessModel = "default", currency = null } = {}) {
  await ensureReportingSchema();
  const [settingsResult, bandsResult, glossaryResult] = await Promise.all([
    selectStageSettings(),
    selectBands(),
    selectGlossary(),
  ]);
  const rows = settingsResult.rows || [];

  // Every override, by model, so the screen can show what is overridden and
  // what is inherited. `default` is excluded: it IS the baseline.
  const overrides = {};
  for (const row of rows) {
    if (!row.business_model || row.business_model === "default") continue;
    if (!overrides[row.business_model]) overrides[row.business_model] = {};
    overrides[row.business_model][row.setting_key] = Number(row.setting_value);
  }

  return {
    settings: buildSettingsMap(rows, businessModel),
    defaults: buildSettingsMap(rows, "default"),
    overrides,
    businessModels: BUSINESS_MODELS,
    bands: groupBands(bandsResult.rows || [], currency),
    glossary: glossaryResult.rows || [],
    // The definitions the settings screen renders, so the UI never hardcodes
    // a key, a range or a label.
    definitions: ALL_SETTINGS,
    groups: SETTING_GROUPS,
  };
}

/**
 * Studio-only write: one new effective-dated row per changed key, never an
 * in-place update. An invalid value aborts the whole batch — a half-applied
 * settings change is worse than none.
 */
export async function updateReportingSettings({
  values = {},
  clear = [],
  businessModel = "default",
  actorCid,
}) {
  await ensureReportingSchema();

  if (!BUSINESS_MODELS.includes(businessModel)) {
    return {
      errors: [{ key: "businessModel", error: "venture.reporting.settings.validation.businessModel" }],
    };
  }

  const errors = [];
  const accepted = [];

  for (const [key, value] of Object.entries(values)) {
    if (value === "" || value === null || value === undefined) continue;
    const error = validateSettingValue(key, value);
    if (error) {
      errors.push({ key, error });
      continue;
    }
    accepted.push({ key, value: Number(value) });
  }

  const removable = [];
  for (const key of Array.isArray(clear) ? clear : []) {
    // The baseline cannot be cleared — it is what every other model inherits.
    if (businessModel === "default") continue;
    if (!isEditableKey(key)) {
      errors.push({ key, error: "venture.reporting.settings.validation.unknown" });
      continue;
    }
    removable.push(key);
  }

  // All-or-nothing: a half-applied settings change is worse than none.
  if (errors.length) return { errors };

  for (const key of removable) {
    await deleteStageSetting({ settingKey: key, businessModel });
  }

  for (const entry of accepted) {
    await insertStageSetting({
      settingKey: entry.key,
      businessModel,
      value: entry.value,
      valueType: "number",
      actorCid,
    });
  }

  return { updated: accepted.map((entry) => entry.key), cleared: removable };
}

/**
 * The glossary — the ONE place a definition lives.
 *
 * It is editable because a definition that cannot be corrected after a
 * misunderstanding is worse than none: churn, retention, LTV and three stage
 * criteria all read these words.
 */
export async function updateGlossary({ entries = [], actorCid }) {
  await ensureReportingSchema();

  const errors = [];
  const accepted = [];

  for (const entry of Array.isArray(entries) ? entries : []) {
    const term = String(entry?.term || "").trim();
    const definitionEn = String(entry?.definition_en || "").trim();
    const definitionFr = String(entry?.definition_fr || "").trim();

    if (!term) {
      errors.push({ key: "term", error: "venture.reporting.settings.validation.term" });
      continue;
    }
    if (!definitionEn || !definitionFr) {
      errors.push({ key: term, error: "venture.reporting.settings.validation.definition" });
      continue;
    }
    if (definitionEn.length > 600 || definitionFr.length > 600) {
      errors.push({ key: term, error: "venture.reporting.settings.validation.definitionLength" });
      continue;
    }

    accepted.push({ term, definition_en: definitionEn, definition_fr: definitionFr });
  }

  // All-or-nothing, like the thresholds: a half-updated glossary is worse
  // than none, because the two languages would disagree.
  if (errors.length) return { errors };

  for (const entry of accepted) {
    await upsertGlossaryTerm({ ...entry, actorCid });
  }

  return { updated: accepted.map((entry) => entry.term) };
}

/** Studio-only write: a new effective-dated row, never an in-place update. */
export async function updateReportingSetting({ settingKey, businessModel, value, valueType, actorCid }) {
  await ensureReportingSchema();
  if (!settingKey) return { error: "venture.reporting.validation.settingKey" };
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return { error: "venture.reporting.validation.settingValue" };
  await insertStageSetting({
    settingKey,
    businessModel: businessModel || "default",
    value: numeric,
    valueType: valueType || "number",
    actorCid,
  });
  return { ok: true };
}
