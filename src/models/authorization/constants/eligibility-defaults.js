/**
 * ImpactOS — Authorization: FEATURE ELIGIBILITY DEFAULTS (compatibility entry).
 *
 * The values now live in ONE inert data module, `../seedData.js`. This file
 * keeps the historic import path (`@/models/authorization/constants`) working
 * without duplicating the data.
 *
 * These values are SEED data: the one-time migrations copy them into
 * `feature_eligibility`. The authorization decision engine never reads them —
 * it reads the database rows, and the static guard keeps it that way.
 */

export {
  FEATURE_ELIGIBILITY_DEFAULTS,
  FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
  PROGRAM_ASSIGNMENT_ROWS,
} from "../seedData";
