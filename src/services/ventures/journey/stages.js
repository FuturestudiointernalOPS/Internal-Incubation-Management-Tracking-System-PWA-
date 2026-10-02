/**
 * journey — Journey stages: table, id resolution, reads, moves, delete.
 *
 * Part of `services/ventures/journey` (split out of the former single
 * 520-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/journey.js`.
 */
import {
  deleteJourneyStageRow,
  ensureJourneyTableSchema,
  parkJourneyStageOrder,
  runInTransaction,
  selectJourneyStageIdsInOrder,
  selectJourneyStageOrders,
  selectJourneyStageRow,
  selectJourneyStagesCore,
  selectJourneyStagesWithArchive,
  selectJourneyStagesWithTemplate,
  selectNextJourneyStageOrder,
  selectVentureIdByCode,
  selectVentureIdByUuid,
  setJourneyStageOrder,
} from "@/models/ventureJourneyStore";

export function rowsOf(result) {
  return (result && result.rows) || [];
}

/** A fresh uuid without depending on the runtime exposing `crypto`. */
export function newUuid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = (Math.random() * 16) | 0;
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      });
}

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

/** JSON text for a task's labels / checklist (accepts an already-parsed array). */
export function toJsonArrayText(value) {
  return JSON.stringify(typeof value === "string" ? safeParse(value, []) : value || []);
}

/** The DB stores review_required as TRUE/FALSE text here. */
export function toReviewRequiredText(value) {
  return value === true || value === 1 || value === "true" ? "TRUE" : "FALSE";
}

// ── Stage table + id resolution ──────────────────────────────────────────────

/** Create the journey stage table when missing and add the configurable fields. */
export async function ensureJourneyTable() {
  await ensureJourneyTableSchema();
}

/**
 * Resolve the internal ventures(id) UUID used by the journey table.
 * Accepts either the VNT- code or the internal UUID.
 */
export async function resolveVentureInternalId(ventureId) {
  if (typeof ventureId === "string" && ventureId.includes("-") && !ventureId.startsWith("VNT-")) {
    try {
      const byIdResult = await selectVentureIdByUuid(ventureId);
      if (byIdResult.rows?.[0]) return byIdResult.rows[0].id;
      return ventureId;
    } catch (_) {
      return ventureId;
    }
  }
  const result = await selectVentureIdByCode(ventureId);
  return result.rows?.[0]?.id || null;
}

// ── Stage reads ──────────────────────────────────────────────────────────────

/**
 * Ordered stages for a Venture — only Venture-facing columns.
 *
 * Archived (soft-deleted) journeys are hidden by default; management surfaces
 * pass { includeArchived: true }. Falls back progressively when the additive
 * archive / template-provenance columns have not been migrated yet.
 */
export async function listJourneyStages(dbId, { includeArchived = false } = {}) {
  try {
    const res = await selectJourneyStagesWithArchive(dbId, { includeArchived });
    return res.rows || [];
  } catch (_) {
    try {
      const res = await selectJourneyStagesWithTemplate(dbId); // archive columns not migrated yet
      return res.rows || [];
    } catch (_) {
      const res = await selectJourneyStagesCore(dbId); // pre-template databases too
      return res.rows || [];
    }
  }
}

export async function getJourneyStage(dbId, stageId) {
  const res = await selectJourneyStageRow(dbId, stageId);
  return res.rows?.[0] || null;
}

export async function nextJourneyStageOrder(dbId) {
  const res = await selectNextJourneyStageOrder(dbId);
  return Number(res.rows?.[0]?.next_order || 1);
}

// ── Stage moves ──────────────────────────────────────────────────────────────

/**
 * Swap a stage with its neighbour (direction: up | down) inside a
 * transaction so the UNIQUE(venture_id, stage_order) constraint is never
 * violated mid-swap.
 */
export async function moveJourneyStage({ dbId, stageId, direction }) {
  return runInTransaction(async (query) => {
    const rows = await selectJourneyStageOrders(query, dbId);
    const list = rows.rows || [];
    const currentIndex = list.findIndex((stage) => stage.id === stageId);
    if (currentIndex === -1) return { error: "Stage not found." };
    const targetIndex = direction === "up" ? currentIndex - 1 : direction === "down" ? currentIndex + 1 : -1;
    if (targetIndex < 0 || targetIndex >= list.length) return { error: "Already at the edge." };

    const currentStage = list[currentIndex];
    const targetStage = list[targetIndex];
    // Park one order at a negative sentinel (orders are positive 1..n), then
    // swap — unique constraint is satisfied after every statement.
    await parkJourneyStageOrder(query, currentStage.id);
    await setJourneyStageOrder(query, currentStage.stage_order, targetStage.id);
    await setJourneyStageOrder(query, targetStage.stage_order, currentStage.id);
    return { success: true };
  });
}

/** Delete a stage and re-serialize the remaining order (1..n) atomically. */
export async function deleteJourneyStage({ dbId, stageId }) {
  return runInTransaction(async (query) => {
    await deleteJourneyStageRow(query, stageId, dbId);
    const rows = await selectJourneyStageIdsInOrder(query, dbId);
    for (let i = 0; i < (rows.rows || []).length; i++) {
      await setJourneyStageOrder(query, i + 1, rows.rows[i].id);
    }
    return { success: true };
  });
}
