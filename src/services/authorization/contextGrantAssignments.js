/**
 * CONTEXT GRANT ASSIGNMENTS (SERVICE layer).
 *
 * Phase E of docs/ROADMAP_ROLES_PROFILES_ACCESS.md — the AUTOMATIC half of the
 * unified assignment registry (Phase C). When a business relationship exists,
 * the registry gains a row saying so (`source = 'automatic'`, one row per
 * relationship period); when the relationship ends, the row is CLOSED, never
 * deleted. The reconcile calls this beside the grant writes, so that "creating
 * a relationship creates the record, and the record ends exactly when the
 * relationship does" (Phase E, step 5).
 *
 * The registry DESCRIBES; it does not decide access — the grants do that. A card
 * is written for any couple whose profile the catalogue knows
 * (`profileKeyForContextRole`), regardless of whether the Context Roles registry
 * maps it to capabilities: a facilitator with no ticked capabilities still HOLDS
 * the facilitator profile.
 *
 * Rules kept from the mechanism (roadmap §0 / Phase E step 4):
 *   - ADDITIVE — a card is only ever added or closed, never rewritten into a new
 *     period.
 *   - ATTRIBUTABLE — only `source = 'automatic'` rows are matched and closed, so
 *     a MANUAL card written from the Person Access screen is never touched.
 *   - REVERSIBLE — one period = one record: ending the relationship closes the
 *     open row; a later reactivation opens a NEW one.
 *
 * No HTTP. The SQL lives in `@/models/authorization/profileAssignmentsStore`.
 */

import {
  ensureProfileAssignmentsSchema,
  listActiveAutomaticAssignments,
  insertProfileAssignment,
  refreshAutomaticAssignmentPeriod,
  closeProfileAssignment,
} from "@/models/authorization/profileAssignmentsStore";

/** An empty result, shared so the shape of a "no work" report is one object. */
function emptyReport(skipped = null) {
  return { opened: [], refreshed: [], closed: [], skipped };
}

/**
 * PURE. What card changes follow from the relationship ids active right now?
 *
 * @param {object} args
 * @param {string[]} [args.sourceIds]  relationship ids active now (venture or
 *   program codes). Each id becomes the `context_id` of its own card.
 * @param {Array<{id: number, context_id?: string|null}>} [args.activeCards]
 *   the ACTIVE automatic cards currently on file.
 * @returns {{toOpen: string[], toRefresh: Array<{id: number, contextId: string}>,
 *   toClose: Array<{id: number, contextId: string|null}>}}
 *   `toOpen` = ids with no open card; `toRefresh` = cards to re-date;
 *   `toClose` = cards whose relationship is gone.
 */
export function planAssignmentCardChanges({ sourceIds = [], activeCards = [] } = {}) {
  const wanted = new Set(
    (sourceIds || [])
      .map((id) => (id === null || id === undefined ? "" : String(id)))
      .filter((id) => id !== ""),
  );

  const covered = new Set();
  const toRefresh = [];
  const toClose = [];
  for (const card of activeCards || []) {
    const contextId =
      card?.context_id === null || card?.context_id === undefined
        ? null
        : String(card.context_id);
    if (contextId !== null && wanted.has(contextId)) {
      covered.add(contextId);
      toRefresh.push({ id: card.id, contextId });
    } else {
      toClose.push({ id: card.id, contextId });
    }
  }

  const toOpen = [...wanted].filter((id) => !covered.has(id));
  return { toOpen, toRefresh, toClose };
}

/**
 * Apply the automatic assignment cards for ONE person and ONE couple.
 *
 * Never throws: a registry write failure is returned as a reason so the calling
 * reconcile (also non-throwing) can report it and move on. A couple whose
 * profile key is unknown to the catalogue is skipped — the registry has no
 * vocabulary for it, so it must not invent a contextless record.
 *
 * @param {string} cid
 * @param {object} args
 * @param {string} args.contextType   the context the couple lives in
 * @param {string|null} args.profileKey  the catalogue key of the couple
 * @param {string[]} args.sourceIds   relationship ids active now (empty = end)
 * @param {string|Date|null} [args.endsAt]  the period's managed end (program
 *   contexts) — null for an open-ended relationship (a founder).
 * @returns {Promise<{opened: string[], refreshed: string[], closed: Array<string|null>,
 *   skipped: string|null, error?: string}>}
 */
export async function syncContextGrantsAssignments(
  cid,
  { contextType = null, profileKey = null, sourceIds = [], endsAt = null } = {},
) {
  if (!cid) return emptyReport("no-cid");
  if (!profileKey || !contextType) return emptyReport("no-profile");

  try {
    await ensureProfileAssignmentsSchema();
    const existing = await listActiveAutomaticAssignments({
      contactCid: String(cid),
      profileKey,
      contextType,
    });
    const plan = planAssignmentCardChanges({
      sourceIds,
      activeCards: existing?.rows || [],
    });

    const opened = [];
    for (const contextId of plan.toOpen) {
      await insertProfileAssignment({
        contactCid: String(cid),
        profileKey,
        contextType,
        contextId,
        endsAt: endsAt ?? null,
        source: "automatic",
        // "code de la relation" — the venture/program code that justifies it.
        sourceRef: contextId,
        createdBy: null,
      });
      opened.push(contextId);
    }

    const refreshed = [];
    for (const card of plan.toRefresh) {
      const result = await refreshAutomaticAssignmentPeriod({
        id: card.id,
        sourceRef: card.contextId,
        endsAt: endsAt ?? null,
      });
      // Count only a row that actually moved, so a replayed reconcile reports
      // nothing (idempotence, roadmap §2).
      if (Number(result?.rowsAffected ?? 0) > 0) refreshed.push(card.contextId);
    }

    const closed = [];
    for (const card of plan.toClose) {
      const result = await closeProfileAssignment({ id: card.id, status: "ended" });
      // Count only a row that actually moved, so a reconcile racing another one
      // does not report a close it did not perform (the guard makes this a
      // no-op on an already-ended row).
      if (Number(result?.rowsAffected ?? 0) > 0) closed.push(card.contextId);
    }

    return { opened, refreshed, closed, skipped: null };
  } catch (error) {
    console.warn(
      `[Authz] syncContextGrantsAssignments(${cid}) failed:`,
      error.message,
    );
    return { ...emptyReport("error"), error: error.message };
  }
}
