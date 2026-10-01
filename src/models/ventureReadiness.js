import db from "@/lib/db";
import { DEFAULT_VENTURE_DOCUMENT_TYPES } from "@/lib/ventureDocumentTypeDefaults";
import { ensureVentureDocumentTypesTable } from "@/models/ventureDocumentTypes";

/**
 * Document-driven Venture readiness — the single source of the Ready / % that
 * replaced the old 10-category investment-readiness engine (see
 * docs/INTELLIGENCE_SUPERVISOR_DECISIONS.md §7).
 *
 * How the percentage works:
 *   - denominator = the Venture's ACTIVE, REQUIRED document types, minus the
 *     ones tagged `not_applicable` (that state is excluded too).
 *   - points per required document: verified → 1 · rejected → 0.5 ·
 *     everything else (pending, under_review, not uploaded) → 0.
 *   - percent = round(points ÷ denominator × 100), null when the Venture has no
 *     required document (indeterminate « — »).
 *   - is_ready = denominator > 0 AND percent === 100.
 *
 * No migration, no stored column: the result is always recomputed on demand.
 */

const ITEM_POINTS = {
  verified: 1,
  rejected: 0.5,
};

/** Built-in required seed — fallback for Ventures without configured types yet. */
const REQUIRED_FALLBACK_TYPES = DEFAULT_VENTURE_DOCUMENT_TYPES.filter(
  (documentType) => documentType.required === true,
).map((documentType) => ({ code: documentType.code, required: true }));

/**
 * Batch readiness for many Ventures in a constant number of queries.
 *
 * @param {string[]} ventureIds internal `ventures.id` values
 * @returns {Array<{venture_id:string, readiness_percent:number|null, is_ready:boolean,
 *  total_required:number, verified_count:number, rejected_count:number,
 *  pending_count:number, missing_count:number}>}
 */
export async function listVentureDocumentReadiness(ventureIds) {
  const ids = (ventureIds || []).filter(Boolean);
  if (ids.length === 0) return [];

  await ensureVentureDocumentTypesTable();

  const placeholders = ids.map(() => "?").join(", ");

  const [typesResult, itemsResult] = await Promise.all([
    db.execute({
      sql: `SELECT venture_id, code, required
            FROM venture_document_types
            WHERE venture_id IN (${placeholders}) AND is_active = TRUE`,
      args: ids,
    }),
    db.execute({
      sql: `SELECT verifications.venture_id, items.category, items.status
            FROM venture_verification_items items
            JOIN venture_verifications verifications ON verifications.id = items.verification_id
            WHERE verifications.venture_id IN (${placeholders})`,
      args: ids,
    }),
  ]);

  const typesByVenture = new Map();
  for (const id of ids) typesByVenture.set(id, []);
  for (const row of typesResult.rows || []) {
    const list = typesByVenture.get(row.venture_id);
    if (list) list.push(row);
  }
  for (const id of ids) {
    if (typesByVenture.get(id).length === 0) typesByVenture.set(id, REQUIRED_FALLBACK_TYPES);
  }

  const itemsByVenture = new Map();
  for (const row of itemsResult.rows || []) {
    const list = itemsByVenture.get(row.venture_id);
    if (list) list.push(row);
    else itemsByVenture.set(row.venture_id, [row]);
  }

  return ids.map((ventureId) => {
    const requiredTypes = (typesByVenture.get(ventureId) || []).filter(
      (documentType) => documentType.required === true,
    );
    const itemStatusByCategory = new Map(
      (itemsByVenture.get(ventureId) || []).map((item) => [item.category, item.status]),
    );

    let denominator = 0;
    let points = 0;
    let verifiedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let missingCount = 0;

    for (const documentType of requiredTypes) {
      const status = itemStatusByCategory.get(documentType.code);
      if (status === "not_applicable") continue;

      denominator += 1;

      if (status === "verified") {
        points += ITEM_POINTS.verified;
        verifiedCount += 1;
      } else if (status === "rejected") {
        points += ITEM_POINTS.rejected;
        rejectedCount += 1;
      } else if (status === "pending" || status === "under_review") {
        pendingCount += 1;
      } else {
        missingCount += 1;
      }
    }

    const readinessPercent =
      denominator > 0 ? Math.round((points / denominator) * 100) : null;

    return {
      venture_id: ventureId,
      readiness_percent: readinessPercent,
      is_ready: denominator > 0 && readinessPercent === 100,
      total_required: denominator,
      verified_count: verifiedCount,
      rejected_count: rejectedCount,
      pending_count: pendingCount,
      missing_count: missingCount,
    };
  });
}

/**
 * Readiness for a single Venture. Returns null when the Venture id is unknown so
 * callers can distinguish « no data » from « indeterminate (no requirement) ».
 */
export async function computeVentureDocumentReadiness(ventureId) {
  const rows = await listVentureDocumentReadiness([ventureId]);
  return rows[0] || null;
}