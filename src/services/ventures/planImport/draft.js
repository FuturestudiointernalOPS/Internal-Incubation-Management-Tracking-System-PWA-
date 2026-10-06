/**
 * Plan import — The stored DRAFT of an import: read, create, correct, discard.
 *
 * Part of `services/ventures/planImport` (split out of the former single
 * 1 178-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/planImport.js`.
 */
import {
  discardOpenPlanImports,
  discardPlanImportRow,
  insertPlanImportRow,
  runInTransaction,
  selectOpenPlanImport,
  selectOpenPlanImportIds,
  selectPlanImport,
  updatePlanImportProposalRow,
} from "@/models/venturePlanImportStore";
import { collectUnmatchedOwners, computeProposalStats } from "./proposal";

// ── THE DRAFT (Phase 2) ─────────────────────────────────────────────────────
//
// A proposal becomes a DRAFT ROW the moment it is produced, so a review has
// something durable to correct and a later step has exactly one thing to apply.
// Nothing in this section touches the journey, milestone, task or deliverable
// tables: a draft is not a change.

/** jsonb arrives parsed or as text depending on the driver path; read it
 *  without caring which. */
const asJson = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }
  return value;
};

const shapePlanImport = (row) =>
  row
    ? {
        id: row.id,
        venture_id: row.venture_id,
        file_name: row.file_name || null,
        file_kind: row.file_kind || null,
        sheets: asJson(row.sheets, []),
        proposal: asJson(row.proposal, { journeys: [], unplaced: [] }),
        stats: asJson(row.stats, {}),
        unmatched_owners: asJson(row.unmatched_owners, []),
        warnings: asJson(row.warnings, []),
        status: row.status,
        created_by: row.created_by || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        applied_at: row.applied_at || null,
        applied_by: row.applied_by || null,
      }
    : null;

/** The Venture's OPEN draft — the one a review is working on, if any. */
export async function getOpenPlanImport(ventureId) {
  const result = await selectOpenPlanImport(ventureId);
  return shapePlanImport(result.rows?.[0]);
}

/** One draft by id, scoped to its Venture so an id from elsewhere is a 404. */
export async function getPlanImport({ id, ventureId }) {
  const result = await selectPlanImport(id, ventureId);
  return shapePlanImport(result.rows?.[0]);
}

/**
 * Store a freshly interpreted proposal as the Venture's open draft.
 *
 * A new reading SUPERSEDES the previous open draft: exactly one draft is open
 * at a time, so "the proposal" is never ambiguous. The replaced draft is kept
 * and marked `discarded` rather than deleted — it is the record of what was
 * once proposed — and the count comes back so the caller can say so out loud.
 */
export async function createPlanImport({
  ventureId,
  fileName = null,
  fileKind = null,
  sheets = [],
  proposal,
  warnings = [],
  actorCid = null,
}) {
  const stats = computeProposalStats(proposal);
  const unmatchedOwners = collectUnmatchedOwners(proposal);

  const { id, superseded } = await runInTransaction(async (query) => {
    const open = await selectOpenPlanImportIds(query, ventureId);
    const supersededCount = (open.rows || []).length;
    if (supersededCount > 0) {
      await discardOpenPlanImports(query, ventureId);
    }
    const inserted = await insertPlanImportRow(query, {
      ventureId,
      fileName,
      fileKind,
      sheets,
      proposal,
      stats,
      unmatchedOwners,
      warnings,
      actorCid,
    });
    return { id: inserted.rows?.[0]?.id || null, superseded: supersededCount };
  });

  return { id, superseded, stats, unmatched_owners: unmatchedOwners };
}

/**
 * Save the reviewer's corrections onto an OPEN draft.
 *
 * Stats and the unmatched-owner list are RECOMPUTED from what is saved, never
 * accepted from the caller: the screen can then say "3 people still not found"
 * and be describing the row that was actually stored.
 */
export async function updatePlanImportProposal({ id, ventureId, proposal }) {
  const stats = computeProposalStats(proposal);
  const unmatchedOwners = collectUnmatchedOwners(proposal);
  const result = await updatePlanImportProposalRow({ id, ventureId, proposal, stats, unmatchedOwners });
  const row = result.rows?.[0];
  if (!row) return { error: "This proposal is no longer open for review." };
  return { draft: shapePlanImport(row) };
}

/** Close an open draft without applying it. The row stays as the record. */
export async function discardPlanImport({ id, ventureId }) {
  const result = await discardPlanImportRow({ id, ventureId });
  return { discarded: Boolean(result.rows?.[0]?.id) };
}
