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
 * Rules (decision D4, spec §16.2 vs §5.3):
 *   - Missing rows = NOT eligible (fail closed).
 *   - UNION over the person's identities: as soon as ONE identity (role, group
 *     or profile) allows the feature, the section is open. A "non" is a refusal
 *     BY IDENTITY, not a global veto — an eligible PROFILE opens a section the
 *     ROLE does not (`evaluateEligibility`); the caller surfaces the SECTION
 *     warning that goes with it (`explainEligibility.openedByProfile`).
 *   - Super Admin bypasses eligibility entirely (handled by the resolver).
 *
 * The union stays BOUNDED: a profile that is incompatible with the baseline
 * role is refused at assignment (§3.3, `profileRoleAssignmentGate`), so this
 * function never widens a section beyond the ceilings the person can hold.
 */

/**
 * Pure eligibility evaluation over pre-loaded rows.
 *
 * D4 — union of the identities: the section is open when at least one row
 * allows it. A row carrying `eligible = 0` is a refusal FOR THAT IDENTITY only;
 * it never cancels another identity's allow (the previous "an explicit deny wins
 * over any allow" rule was retired by D4).
 *
 * @param {Array<{feature_key, identity_type?, identity_value?, eligible}>} rows
 *   Rows already filtered to the user's identities (role + groups + profiles).
 * @param {string} featureKey
 * @returns {boolean} true when at least one identity allows the feature.
 */
export function evaluateEligibility(rows, featureKey) {
  for (const row of rows || []) {
    if (row.feature_key !== featureKey) continue;
    if (Number(row.eligible) === 1) return true; // union: any allow opens it
  }
  return false; // no identity allows = not eligible (fail closed)
}

/**
 * Pure eligibility WITH its justification (D4, spec §16.2/§5.3). Same verdict
 * as `evaluateEligibility`, plus the ONE divergence the arbitrage calls out: a
 * PROFILE opening a section the ROLE **explicitly denies**.
 *
 * `openedByProfile` is THAT case only — the role carries an `eligible = 0` row
 * for the feature AND no role row allows it, yet a profile does. The access is
 * granted (union); the warning is a SECTION-level notice shown by the caller,
 * never a refusal.
 *
 * @returns {{eligible: boolean, openedByProfile: boolean}}
 */
export function explainEligibility(rows, featureKey) {
  let eligible = false;
  let roleAllows = false;
  let roleDenies = false;
  let profileAllows = false;

  for (const row of rows || []) {
    if (row.feature_key !== featureKey) continue;
    const allows = Number(row.eligible) === 1;
    if (allows) eligible = true;
    if (row.identity_type === "role") {
      if (allows) roleAllows = true;
      else roleDenies = true;
    } else if (row.identity_type === "profile" && allows) {
      profileAllows = true;
    }
  }

  return {
    eligible,
    openedByProfile: eligible && profileAllows && !roleAllows && roleDenies,
  };
}
