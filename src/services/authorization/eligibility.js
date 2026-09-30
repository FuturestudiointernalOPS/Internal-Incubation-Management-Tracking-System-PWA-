/**
 * Authorization — eligibility decision (SERVICE layer).
 *
 * Eligibility answers ONE question: "Is this person allowed to RECEIVE this
 * feature?" It is deliberately separate from capability assignment:
 *
 *     ELIGIBLE ≠ GRANTED
 *
 * The decision is pure: it reads the rows it is given and answers. The rows
 * come from the authorization context resolver (which fetches them in one
 * query); the schema and the one-time seeds stay in the repository
 * (`@/models/authorization/eligibility`).
 *
 * Rules, unchanged:
 *   - Missing rows = NOT eligible (fail closed).
 *   - An explicit `eligible = 0` row wins over any `eligible = 1` row.
 *   - Super Admin bypasses eligibility entirely (handled by the resolver).
 */

/**
 * Pure eligibility evaluation over pre-loaded rows.
 *
 * @param {Array<{feature_key, eligible}>} rows
 *   Rows already filtered to the user's identities (role + groups).
 * @param {string} featureKey
 * @returns {boolean} true when at least one identity is eligible AND no
 *   identity explicitly denies the feature.
 */
export function evaluateEligibility(rows, featureKey) {
  let anyEligible = false;
  for (const row of rows || []) {
    if (row.feature_key !== featureKey) continue;
    if (Number(row.eligible) === 1) anyEligible = true;
    else return false; // explicit deny wins over any allow
  }
  return anyEligible; // missing rows = not eligible (fail closed)
}
