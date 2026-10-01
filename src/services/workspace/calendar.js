import {
  selectVentureScope,
  selectInternalVentureIds,
  selectPersonalVentureSessions,
  selectCalendarVentureScope,
  selectCoachedVentureIds,
  selectVentureIdsByCodes,
} from "@/models/workspaceCalendarStore";
import {
  getFacilitatorProgramScopePids,
  getParticipantProgramScopePids,
} from "@/models/workspace";

/**
 * Workspace service — the personal-calendar Venture session source.
 *
 * Layer (see docs/LAYER_SPLIT.md): the decision lives here; every statement
 * lives in `@/models/workspaceCalendarStore`.
 */

/**
 * Venture sessions for one person's own calendar (Vinance 3, Phase 3).
 *
 *   - the coach's own sessions, whatever their visibility (coach_contact_id)
 *   - venture-facing sessions of the Ventures the person belongs to as a
 *     member (venture_members) or is actively assigned to as staff
 *     (venture_staff_assignments)
 *
 * Cancelled and no-show sessions are never calendar events. Venture ids are
 * stored in both key styles (the VNT code and the internal UUID), so the scope
 * list is expanded to cover both. Returns { rows } like the other getters.
 */
export async function getCalendarVentureSessions(userId) {
  const empty = { rows: [] };
  if (!userId) return empty;

  // 1. The person's Venture scope (membership ∪ active staff assignment).
  const scopeRes = await selectVentureScope(userId).catch(() => empty);
  const ventureCodes = (scopeRes.rows || []).map((row) => row.venture_id).filter(Boolean);

  // 2. Expand to the internal ids too (rows may be keyed either way).
  let internalVentureIds = [];
  if (ventureCodes.length > 0) {
    const idRes = await selectInternalVentureIds(ventureCodes).catch(() => empty);
    internalVentureIds = (idRes.rows || []).map((row) => row.id).filter(Boolean);
  }
  const scope = [...new Set([...ventureCodes, ...internalVentureIds])];
  // Sentinel: a person with no Ventures still gets their own coach sessions,
  // and the IN list can never match a real venture id.
  const scopeList = scope.length > 0 ? scope : ["__no_venture_scope__"];

  return selectPersonalVentureSessions(userId, scopeList);
}

// ─── The unified-calendar scope decisions ────────────────────────────────────

// Roles that see every program on the calendar, regardless of assignment.
const PROGRAM_UNSCOPED_ROLES = [
  "super_admin",
  "staff",
  "program_manager",
  "team",
];

// Roles that see every Venture, unless personal mode is on.
const PRIVILEGED_VENTURE_ROLES = ["staff", "super_admin", "program_manager"];

/**
 * Which programs the caller may see on the unified calendar (GET /api/calendar).
 *
 * Program scope is derived from RELATIONSHIPS, not from the platform role label.
 * The identity correction stopped mutating `contacts.role` when someone takes a
 * facilitator assignment, so keying this on `role === 'facilitator'` left every
 * other contextual identity (a `member` acting as a facilitator, for instance)
 * falling through to `null` — which means NO restriction and every program's
 * sessions, deliverables and follow-ups. That was a fail-open read.
 *
 * Internal / privileged identities keep their unscoped view; everyone else is
 * restricted to the programs they are actually assigned to (facilitator) or
 * enrolled in (participant), and an empty scope stays empty rather than silently
 * meaning "all". Returns the WHERE fragments and their arguments, ready to be
 * handed to the repository getters.
 */
export async function resolveCalendarProgramScope(sessionCid, role) {
  const none = {
    scopedProgramIds: null,
    programScopeSql: "",
    programTableScopeSql: "",
    programScopeArgs: [],
  };
  if (!sessionCid || PROGRAM_UNSCOPED_ROLES.includes(role)) return none;

  const [facilitatorPids, participantPids] = await Promise.all([
    getFacilitatorProgramScopePids(sessionCid),
    getParticipantProgramScopePids(sessionCid),
  ]);
  const programIdSet = new Set([
    ...(facilitatorPids.rows || []).map((row) => String(row.pid)),
    ...(participantPids.rows || []).map((row) => String(row.pid)),
  ]);
  // Fail closed: no relationship at all means NO program-scoped events.
  const scopedProgramIds = programIdSet.size
    ? [...programIdSet]
    : ["__no_program_scope__"];
  const placeholders = scopedProgramIds.map(() => "?").join(",");

  return {
    scopedProgramIds,
    programScopeSql: ` AND CAST(program_id AS TEXT) IN (${placeholders})`,
    programTableScopeSql: ` AND CAST(id AS TEXT) IN (${placeholders})`,
    programScopeArgs: scopedProgramIds,
  };
}

/**
 * Follow-up visibility on the unified calendar: super_admin sees all;
 * participants see their own; everyone else sees follow-ups they assigned
 * (legacy NULL rows remain visible). Returns the WHERE fragment + arguments.
 */
export function resolveCalendarFollowupVisibility(sessionCid, role) {
  if (role === "participant" && sessionCid) {
    return {
      followupVisibilitySql: " AND f.participant_id = ?",
      followupVisibilityArgs: [sessionCid],
    };
  }
  if (role !== "super_admin" && sessionCid) {
    return {
      followupVisibilitySql: " AND (f.created_by IS NULL OR f.created_by = ?)",
      followupVisibilityArgs: [sessionCid],
    };
  }
  return { followupVisibilitySql: "", followupVisibilityArgs: [] };
}

/**
 * Venture scope on the unified calendar:
 *   - privileged roles see every Venture, unless personal mode is on;
 *   - personal mode restricts even privileged roles to the Ventures they are
 *     assigned to plus the sessions they coach;
 *   - founders/team see their own member Ventures (keyed on the VNT code);
 *   - delegated staff see their active assignments.
 *
 * A coach's own sessions count even when stored under a UUID key or when the
 * coach holds no assignment row yet. Membership/assignment codes are TEXT while
 * canonical Venture rows are UUID-keyed, so codes are resolved to internal ids
 * and the scope covers BOTH key styles; entries that resolve to neither are
 * kept as ids (stale codes simply match nothing). Returns `null` scopes for 
 * "no restriction".
 */
export async function resolveCalendarVentureScope(
  sessionCid,
  role,
  personalMode,
) {
  const seesAllVentures =
    PRIVILEGED_VENTURE_ROLES.includes(role) && !personalMode;

  // null = no restriction; the caller skips the whole Venture block when the
  // scope stays empty (see the route).
  if (seesAllVentures || !sessionCid) {
    return { seesAllVentures, ventureScope: null, scopeIds: null };
  }

  const ventureScopeResult = await selectCalendarVentureScope(sessionCid).catch(
    () => ({ rows: [] }),
  );
  let scopeList = (ventureScopeResult.rows || [])
    .map((row) => row.venture_id)
    .filter(Boolean);
  if (personalMode) {
    const coachSessionsResult = await selectCoachedVentureIds(sessionCid).catch(
      () => ({ rows: [] }),
    );
    scopeList = [
      ...scopeList,
      ...(coachSessionsResult.rows || [])
        .map((row) => row.venture_id)
        .filter(Boolean),
    ];
  }
  const ventureScope = [...new Set(scopeList)];

  if (ventureScope.length === 0) {
    return { seesAllVentures, ventureScope, scopeIds: null };
  }

  const ventureIdResult = await selectVentureIdsByCodes(ventureScope).catch(
    () => ({ rows: [] }),
  );
  const resolvedCodes = new Set(
    (ventureIdResult.rows || []).map((row) => row.venture_id),
  );
  const mappedIds = (ventureIdResult.rows || [])
    .map((row) => row.id)
    .filter(Boolean);
  const leftoverIds = ventureScope.filter(
    (scopeKey) => !resolvedCodes.has(scopeKey),
  );
  const scopeIds = [...new Set([...mappedIds, ...leftoverIds])];

  return { seesAllVentures, ventureScope, scopeIds };
}
