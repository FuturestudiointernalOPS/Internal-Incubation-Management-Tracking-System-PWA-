/**
 * VENTURE STARTUP-PROFILE WIZARD.
 *
 * The 6-step wizard that captures a Venture's startup profile: the per-step
 * validation rules (pure), the completion calculation (pure), the profile /
 * progress readers and writers, the document upsert, and the edit/read access
 * checks (founder-or-super-admin to edit; delegated staff or founder to read).
 *
 * The decisions — which step column to write, how completion is weighted, who
 * may edit or read — live here; every statement is in
 * `@/models/ventureProfileStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) —
 * see docs/LAYER_SPLIT.md.
 *
 * Split (lane L2): the code lives in `./profile/` — wizard, records, access.
 * This file re-exports the same public surface (named + default when there is
 * one), so importers and tests are unchanged.
 */

export {
  WIZARD_STEP_VALIDATORS,
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  WIZARD_STEPS_MAP,
  TOTAL_WIZARD_STEPS,
  calculateCompletion,
} from "./profile/wizard";
export {
  getOrCreateStartupProfile,
  updateWizardStep,
  validateStep,
  validateFullProfile,
  submitStartupProfile,
  uploadProfileDocument,
  deleteProfileDocument,
} from "./profile/records";
export {
  canEditStartupProfile,
  canReadStartupProfile,
} from "./profile/access";

