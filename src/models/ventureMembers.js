/**
 * VENTURE MEMBERS — who belongs to a Venture, read as ONE list.
 *
 * A Venture's people live in the membership table: one row per person, carrying
 * the role, the "lead founder" / "owner" flags and the suspend / removal
 * markers. This module is the single read that every Venture surface uses
 * (detail, dashboard, counters, member list), so a Venture's head count can no
 * longer be counted from two different places and contradict itself.
 *
 * The older founder table is an INVITATION LEDGER (an email plus a
 * pending/accepted status), not a membership list. It is still displayed on the
 * founders screen — where invitations are managed — but it is NEVER the source
 * of a member count.
 */

function rowsOf(result) {
  return (result && result.rows) || [];
}

/** Venture ids travel as the public code (VNT-…) in this table. */
const asCode = (ventureId) => String(ventureId || "");

/**
 * Every member of a Venture, founder first.
 *
 * The contact join uses the contact id when present and the user id otherwise,
 * because both generations of rows exist in the table.
 */
export async function listVentureMembers(db, ventureId, { includeRemoved = false } = {}) {
  const result = await db.execute({
    sql: `SELECT vm.id, vm.contact_id, vm.user_cid, vm.member_type, vm.role,
                 vm.permissions, vm.joined_at, vm.lead_founder, vm.is_owner,
                 vm.suspended_at, vm.removed_at,
                 c.name, c.email, c.phone
          FROM venture_members vm
          LEFT JOIN contacts c ON c.cid = COALESCE(vm.contact_id, vm.user_cid)
          WHERE vm.venture_id = ?${includeRemoved ? "" : " AND vm.removed_at IS NULL"}
          ORDER BY COALESCE(vm.lead_founder, FALSE) DESC,
                   COALESCE(vm.is_owner, FALSE) DESC,
                   vm.id ASC`,
    args: [asCode(ventureId)],
  });

  return rowsOf(result).map(normalizeMember);
}

/** One row → the shape the screens render (no SQL naming leaks out). */
export function normalizeMember(row) {
  const isOwner = row.is_owner === true || row.is_owner === 1 || row.is_owner === "true";
  const isLead = row.lead_founder === true || row.lead_founder === 1 || row.lead_founder === "true";
  const memberType = String(row.member_type || "team_member");
  const isFounder = memberType === "founder" || isOwner || isLead;
  const suspended = Boolean(row.suspended_at);
  const removed = Boolean(row.removed_at);

  return {
    id: row.id,
    contact_id: row.contact_id || row.user_cid || null,
    name: row.name || null,
    email: row.email || null,
    phone: row.phone || null,
    member_type: memberType,
    role: row.role || (isFounder ? "founder" : "member"),
    is_founder: isFounder,
    is_owner: isOwner || isLead,
    is_lead_founder: isLead,
    permissions: row.permissions || null,
    joined_at: row.joined_at || null,
    suspended_at: row.suspended_at || null,
    removed_at: row.removed_at || null,
    status: removed ? "removed" : suspended ? "suspended" : "active",
  };
}

/**
 * The counts every screen shows, derived from the membership list ONLY.
 *   members   — everybody still in the Venture
 *   founders  — members carrying the founder relation (owner included)
 *   team      — members who are not founders
 *   suspended — members temporarily suspended
 */
export function summarizeVentureMembers(members = []) {
  const list = members || [];
  return {
    total: list.length,
    active: list.filter((member) => member.status === "active").length,
    founders: list.filter((member) => member.is_founder).length,
    team: list.filter((member) => !member.is_founder).length,
    suspended: list.filter((member) => member.status === "suspended").length,
    removed: list.filter((member) => member.status === "removed").length,
    owner: list.find((member) => member.is_owner) || null,
    members: list,
  };
}

export default { listVentureMembers, summarizeVentureMembers, normalizeMember };
