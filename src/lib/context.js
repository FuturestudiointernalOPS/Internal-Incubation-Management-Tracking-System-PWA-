/**
 * Context labels + active-context matching (pure).
 *
 * Consumed by the context switcher: it labels a context row for a human
 * (`contextRoleLabelKey`) and decides which context row the current page
 * belongs to (`activeContextFromPathname`).
 *
 * There is deliberately NO pathname → role map here. The sidebar used to take
 * its role from the visited surface; it is now driven only by the connected
 * user's role + effective capabilities (see `buildAccessNav` in
 * `lib/masterNavigation`). A pathname never selects a role.
 *
 * Pure functions only: this is UI/context PROJECTION. It NEVER authorizes.
 * Server-side guards remain authoritative.
 */

/**
 * Human label key under common.workspaces for a context item.
 *
 * - venture rows: member_type/role/is_owner decide Founder vs Venture Member.
 * - lms rows: always the Learner label.
 * - role rows: known contextual roles map to their label; anything else
 *   (responsibility keys, free-text roles, "member") falls back to the
 *   member label — same fallback the context switcher historically used.
 */
export function contextRoleLabelKey({ kind, row = {} }) {
  const role = String(row.role || "").toLowerCase();
  if (kind === "venture") {
    const isFounder =
      String(row.member_type || "").toLowerCase() === "founder" ||
      row.is_owner ||
      row.isOwner ||
      role === "founder";
    return isFounder ? "roleFounder" : "roleVentureMember";
  }
  if (kind === "lms") return "roleLearner";
  const map = {
    facilitator: "roleFacilitator",
    participant: "roleParticipant",
    staff: "roleStaff",
    program_manager: "roleProgramManager",
    finance: "roleFinance",
    intern: "roleIntern",
  };
  return map[role] || "roleOther";
}

/**
 * Active-context matching for the context switcher.
 *
 * A "hat item" is a navigable context the user operates IN: program
 * assignment, program participation, venture membership, learning. Group
 * memberships and responsibilities are excluded — they are entitlements that
 * sit under a surface, not hats with their own workspace.
 *
 * The longest matching context href wins (deepest context). No match means
 * the user is on baseline/home territory (their own dashboard), where no
 * contextual hat is worn.
 */
export function activeContextFromPathname(pathname, items = []) {
  if (!pathname || !Array.isArray(items)) return null;
  const HAT_TYPES = new Set([
    "program_assignment",
    "program_participation",
    "venture",
    "learning",
  ]);
  let best = null;
  for (const item of items) {
    if (!item || !item.href || !HAT_TYPES.has(item.type)) continue;
    const href = String(item.href);
    if (pathname !== href && !pathname.startsWith(`${href}/`)) continue;
    if (!best || href.length > String(best.href).length) best = item;
  }
  return best;
}
