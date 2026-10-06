/**
 * Investor service — the diligence status policy.
 *
 * Which status transitions a caller may make on a diligence request, and the
 * refusal message a blocked one shows. Pure decisions, no SQL, no HTTP.
 */

/**
 * Which status transitions a caller may make on a diligence request.
 *
 * A caller with investor CONTEXT (investor role, or a baseline member holding
 * an investor profile) must not receive the Venture-side transitions. This was
 * previously decided on the role STRING, so a member-with-profile slipped
 * through as if they were a founder.
 */
export function canTransitionDiligenceStatus({
  status,
  isAdmin,
  isRM,
  isIM,
  isInvestorContext,
}) {
  const allowedTransitions = {
    under_review: isAdmin || isRM,
    documents_uploaded: isAdmin || isRM || !isInvestorContext,
    verified: isAdmin || isIM,
    completed: isAdmin || isIM,
    responded: isAdmin || isRM || isIM || !isInvestorContext,
    closed: isAdmin || isRM || isIM,
  };
  return Boolean(allowedTransitions[status]) || isAdmin;
}

/** The refusal message a blocked transition shows. */
export function diligenceTransitionRefusal(status) {
  const who =
    status === "under_review"
      ? "Relationship Manager"
      : status === "verified" || status === "completed"
        ? "Investment Manager"
        : "authorized staff";
  return `Only the ${who} can perform this action.`;
}