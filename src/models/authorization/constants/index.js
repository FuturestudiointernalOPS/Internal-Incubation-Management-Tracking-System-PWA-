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
// The animation-rights definition the registry imports (and the PM assignment
// vocabulary uses). Exposed here so callers have one constants entry point.
export {
  FACILITATOR_MODULE,
  FACILITATOR_CAPABILITY_KEYS,
} from "./facilitator-capabilities";
export {
  FEATURE_ELIGIBILITY_DEFAULTS,
  FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
  PROGRAM_ASSIGNMENT_ROWS,
} from "./eligibility-defaults";
