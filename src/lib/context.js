/**
 * PHASE I3 — Context-surface resolution (pure).
 *
 * Single source for "which surface does this pathname belong to" — the role
 * map historically lived inside DashboardLayout; this module makes the
 * resolution unit-testable and reusable by the context switcher.
 *
 * Pure functions only: this is UI/context PROJECTION. It NEVER authorizes.
 * Server-side guards remain authoritative.
 */

/** Pathname prefix → surface (legacy role used by that area's UI/context). */
export const PATH_CONTEXT_ROLES = [
  { prefix: "/admin", role: "super_admin" },
  { prefix: "/pm", role: "program_manager" },
  { prefix: "/staff", role: "staff" },
  { prefix: "/teacher", role: "teacher" },
  { prefix: "/facilitator", role: "facilitator" },
  { prefix: "/participant", role: "participant" },
  { prefix: "/developer", role: "developer" },
  { prefix: "/finance", role: "finance" },
  { prefix: "/investor", role: "investor" },
  { prefix: "/crm", role: "crm" },
  { prefix: "/team", role: "team" },
  { prefix: "/workspaces", role: "member" },
];

/** Home href per surface (context landing). */
export const SURFACE_HOMES = {
  super_admin: "/admin",
  program_manager: "/pm",
  staff: "/staff",
  teacher: "/teacher",
  facilitator: "/facilitator",
  participant: "/participant",
  developer: "/developer",
  finance: "/finance",
  investor: "/investor",
  crm: "/crm",
  team: "/team",
  member: "/workspaces",
};

/**
 * Which surface does a pathname belong to? Longest prefix wins, null for
 * paths outside every surface (e.g. "/login").
 */
export function resolveActiveSurface(pathname) {
  if (!pathname) return null;
  let best = null;
  let bestLen = -1;
  for (const { prefix, role } of PATH_CONTEXT_ROLES) {
    if (pathname.startsWith(prefix) && prefix.length > bestLen) {
      best = role;
      bestLen = prefix.length;
    }
  }
  return best;
}

/** Home href for a surface, falling back to the member workspace. */
export function surfaceHome(surface) {
  return SURFACE_HOMES[surface] || SURFACE_HOMES.member;
}

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
    teacher: "roleTeacher",
    finance: "roleFinance",
    intern: "roleIntern",
  };
  return map[role] || "roleOther";
}
