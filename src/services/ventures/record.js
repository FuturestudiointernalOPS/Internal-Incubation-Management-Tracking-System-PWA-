/**
 * VENTURE CORE RECORD (read / update / lead change).
 *
 * The assembled Venture read (row + founders + members + activity + history +
 * progress), the rename/update with the name↔company_name mirroring, and the
 * lead change (clear the previous lead, promote the new one, append the
 * ownership history, mirror the roles and refresh the context grants).
 *
 * The decisions — the id normalization, the mirrored columns, the allowed
 * fields and the lead-change sequence — live here; every statement is in
 * `@/models/ventureRecordStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) — see
 * docs/LAYER_SPLIT.md.
 */

import {
  selectVentureCodeByInternalId,
  selectVentureByBusinessKey,
  selectFoundersByVenture,
  selectVentureMembersForRecord,
  selectVentureActivityForJournal,
  selectVentureHistory,
  selectVentureProfileProgress,
  updateVentureColumns,
  selectActiveVentureMember,
  selectCurrentVentureLead,
  clearVentureLead,
  promoteVentureMember,
  insertLeadOwnershipHistory,
} from "@/models/ventureRecordStore";
import { summarizeVentureMembers } from "@/models/ventureMembers";

/**
 * Get a venture by its venture_id with founder info.
 */
export async function getVentureById(ventureId) {
  // Normalize: routes may receive a numeric/UUID id (e.g. from list pages or
  // pre-fix promoted ventures). Resolve it to the VNT business key first.
  let key = ventureId;
  if (ventureId && !/^VNT-/i.test(ventureId)) {
    try {
      const byId = await selectVentureCodeByInternalId(ventureId);
      if (byId.rows.length > 0 && byId.rows[0].venture_id) {
        key = byId.rows[0].venture_id;
      }
    } catch (_) {}
  }

  const ventureRes = await selectVentureByBusinessKey(key);

  if (ventureRes.rows.length === 0) return null;

  const venture = ventureRes.rows[0];

  // Get founders
  const foundersRes = await selectFoundersByVenture(key);

  // Get members — the membership list IS the Venture's people. The founder table
  // read above is the INVITATION ledger; it is shown on the founders screen and
  // is never the source of a member count.
  let members = [];
  try {
    members = await selectVentureMembersForRecord(key);
  } catch (_) {}
  const memberSummary = summarizeVentureMembers(members);

  // Get recent activity. The actor is resolved to a person when the log kept an
  // id instead of a name, so the journal never reads "by USR_…".
  let activity = [];
  try {
    const activityRes = await selectVentureActivityForJournal(key);
    activity = (activityRes.rows || []).map((activityRow) => ({
      ...activityRow,
      actor_name: activityRow.actor_resolved_name || activityRow.actor_name || null,
    }));
  } catch (_) {}

  // Get history
  const historyRes = await selectVentureHistory(key);

  // Get startup profile progress
  let profileProgress = null;
  try {
    const progressRes = await selectVentureProfileProgress(key);
    profileProgress = progressRes.rows[0] || null;
  } catch (_) {}

  return {
    ...venture,
    founders: foundersRes.rows,
    members,
    member_summary: memberSummary,
    activity,
    history: historyRes.rows,
    profile_progress: profileProgress,
  };
}

/**
 * Update a venture record.
 */
export async function updateVenture(ventureId, updates) {
  const allowedFields = [
    "name",
    "company_name",
    "registration_number",
    "mission",
    "vision",
    "industry",
    "sector",
    "business_stage",
    "description",
    "website",
    "logo_url",
    "social_media",
    "status",
    "visibility",
    "language",
    "branding",
    "country",
    "country_code",
    "registration_status",
    "north_star",
    // How the engagement is being run (Incubation / Acceleration / Hybrid) — a
    // label on the Venture, never a level in the hierarchy. Its values live in
    // venture_option_values so they can be renamed without a code change.
    "programme_type",
  ];

  const setClauses = [];
  const args = [];

  // `ventures` carries TWO columns for the same thing — the legacy `name` and
  // the canonical `company_name` (see HANDOVER_VENTURES.md: two generations of
  // the table). Callers write one of them, so a rename used to leave the other
  // stale: the profile screens send only `company_name`, and any surface still
  // reading `name` (the founder's My Ventures card, the portfolio reports) kept
  // showing the Venture's original label — for intake-created Ventures, the
  // name of the Run that collected the application. Mirroring the two here, on
  // the one function every rename goes through, keeps them telling one story.
  const mirrored = { ...updates };
  if (mirrored.company_name !== undefined && mirrored.name === undefined) {
    mirrored.name = mirrored.company_name;
  } else if (mirrored.name !== undefined && mirrored.company_name === undefined) {
    mirrored.company_name = mirrored.name;
  }

  for (const field of allowedFields) {
    if (mirrored[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      args.push(mirrored[field]);
    }
  }

  if (setClauses.length === 0) {
    return { updated: false };
  }

  setClauses.push("updated_at = NOW()");
  args.push(ventureId);

  await updateVentureColumns(setClauses, args);

  return { updated: true };
}

/**
 * Change the lead founder / owner of a Venture (Phase 4).
 *
 * The new lead must be an existing active member. The previous lead is
 * cleared, the new member becomes lead_founder + is_owner (member_type
 * founder), the change is appended to ownership_history and audited.
 * A Venture can never end up without a lead through this action.
 */
export async function changeVentureLead({ ventureId, memberId, actorCid }) {
  const memberRes = await selectActiveVentureMember(memberId, ventureId);
  const member = memberRes.rows[0];
  if (!member) return { error: "Venture member not found." };

  // Capture the current lead/owner (if any) before clearing — used for the
  // append-only contact_roles history mirror.
  let previousLeadCid = null;
  try {
    const prev = await selectCurrentVentureLead(ventureId);
    previousLeadCid = prev.rows?.[0]?.contact_id || null;
  } catch (_) {}

  // Clear the current lead/owner (if any)
  await clearVentureLead(ventureId);

  // Promote the new lead
  await promoteVentureMember(memberId);

  // Append-only ownership history
  try {
    await insertLeadOwnershipHistory(
      ventureId,
      member.contact_id || member.user_cid || memberId,
      member.name || "",
      actorCid || "system",
    );
  } catch (_) {}

  // Append-only contact_roles mirror (context_type='venture')
  try {
    const { syncVentureRoleHistory } = await import("@/lib/contactIdentity");
    const newLeadCid = member.contact_id || member.user_cid || memberId;
    if (previousLeadCid && previousLeadCid !== newLeadCid) {
      await syncVentureRoleHistory({
        contactCid: previousLeadCid,
        ventureId,
        role: "founder",
        active: false,
        actorCid: actorCid || null,
        notes: "founder replaced",
      });
    }
    await syncVentureRoleHistory({
      contactCid: newLeadCid,
      ventureId,
      role: "founder",
      active: true,
      actorCid: actorCid || null,
      notes: "lead founder changed",
    });
  } catch (_) {}

  // Phase 6: the new lead is a founder — make sure the venture relationship
  // grants what the Context Roles registry maps for venture:founder. Kept last
  // so it never disturbs the ownership-history/audit writes above.
  try {
    const { syncContextGrantsForUser } = await import("@/services/authorization/contextGrants");
    await syncContextGrantsForUser(member.contact_id || member.user_cid);
  } catch (_) {}

  return { success: true };
}
