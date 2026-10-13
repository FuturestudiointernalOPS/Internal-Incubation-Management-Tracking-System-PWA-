/**
 * Authorization constants — the pure feature/eligibility vocabulary, grouped
 * by file. Import from here: `@/models/authorization/constants`.
 */
export { FEATURE_ORDER, MODULE_TO_FEATURE } from "./features";
// The one capability source and the two views derived from it.
export {
  FEATURE_MODULE_CAPABILITY,
  CAPABILITY_CATALOG,
  PERMISSION_MODULES,
} from "./feature-module-capability";
export {
  FEATURE_ELIGIBILITY_DEFAULTS,
  FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
  PROGRAM_ASSIGNMENT_ROWS,
} from "./eligibility-defaults";
