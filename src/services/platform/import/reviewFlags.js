/**
 * Platform — the CSV/XLSX import: identity-review flags (SERVICE layer).
 *
 * The read/write of the "verify identity" queue the execute row loop raises for
 * name-only matches.
 *
 * Split of `services/platform/import.js` (see docs/LAYER_SPLIT.md): this is the
 * `reviewFlags` slice; the barrel at the original path re-exports the same
 * surface.
 *
 * Layer: decisions and orchestration, no SQL, no HTTP. It reads and writes
 * through `@/models/platformImport`.
 */

import { listImportReviewFlags, updateImportReviewFlagStatus } from "@/models/platformImport";

// ── Review flags ────────────────────────────────────────────────────────────

/** @returns {Promise<{status: number, body: Object}>} */
export async function listReviewFlags({ status, runId, formId }) {
  const result = await listImportReviewFlags(status, runId, formId);
  return { status: 200, body: { success: true, flags: result.rows } };
}

/** @returns {Promise<{status: number, body: Object}>} */
export async function setReviewFlagStatus({ id, status }) {
  if (!id) {
    return { status: 400, body: { success: false, error: "id is required" } };
  }

  const valid = ["pending", "resolved"];
  if (status && !valid.includes(status)) {
    return { status: 400, body: { success: false, error: "Invalid status" } };
  }

  const result = await updateImportReviewFlagStatus(status, id);
  return { status: 200, body: { success: true, flag: result.rows[0] || null } };
}
