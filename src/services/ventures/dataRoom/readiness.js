/**
 * services/ventures/dataRoom/readiness — Investment Readiness, for one Venture
 * or for a whole page of them.
 *
 * THE SINGLE READINESS ENGINE IS THE DATA ROOM'S. `computeDataRoomCompleteness`
 * already decides what "filed and verified" means: only `required` categories
 * count, only `verified` earns a point, and a Venture with nothing
 * required is INDETERMINATE (`null`) rather than 0% or 100%.
 *
 * This module adds no rule of its own. It exists for one reason: the admin
 * venture directory and the Intelligence dashboard need that same answer for
 * many Ventures at once, and the per-Venture reader costs three queries per row.
 * Everything below feeds the identical computation from three batched queries.
 *
 * NO WRITES. The per-Venture path seeds default requirements on first open; a
 * list must not (a page view is not a reason to touch N Ventures). When a
 * Venture has no stored requirements, the SAME `defaultRequirements(stage)`
 * the seeding would have written is applied in memory, so the list and the
 * detail page agree the first time either is opened.
 */

import { defaultRequirements } from "@/lib/dataRoom";
import {
  selectDataRoomDocumentStatusesForVentures,
  selectDataRoomRequirementsForVentures,
  selectVentureStagesForVentures,
} from "@/models/ventureDataRoomStore";
import { resolveVentureInternalIds } from "@/models/ventureIdentityStore";
import { computeDataRoomCompleteness } from "./access";

/** A failed read degrades that Venture to "unknown", never to a fake score. */
function readFailure(label) {
  return (error) => {
    console.error(`[data-room-readiness] ${label} read failed:`, error?.message || error);
    return { rows: [] };
  };
}

/** The empty row: what a caller shows as « — ». */
function unknownRow(ventureId) {
  return {
    venture_id: String(ventureId),
    readiness_percent: null,
    is_ready: false,
    total_required: 0,
    verified_count: 0,
    rejected_count: 0,
    pending_count: 0,
    missing_count: 0,
  };
}

/**
 * Data Room completeness for many Ventures.
 *
 * `ventureRefs` may be internal ids OR the VNT codes a URL carries; both forms
 * are resolved, and the row echoes the INTERNAL id — which is what the callers
 * key on. Ordering follows the input.
 *
 * @returns {Promise<Array<object>>} one row per resolvable Venture
 */
export async function listDataRoomReadiness(ventureRefs = []) {
  const refs = (ventureRefs || []).filter(Boolean);
  if (refs.length === 0) return [];

  const ids = await resolveVentureInternalIds(refs);
  if (!ids || ids.length === 0) return [];

  const [stagesResult, requirementsResult, documentsResult] = await Promise.all([
    selectVentureStagesForVentures(ids).catch(readFailure("stages")),
    selectDataRoomRequirementsForVentures(ids).catch(readFailure("requirements")),
    selectDataRoomDocumentStatusesForVentures(ids).catch(readFailure("documents")),
  ]);

  const stageByVenture = new Map(
    (stagesResult.rows || []).map((row) => [String(row.id), row.business_stage || "idea"]),
  );

  const requirementsByVenture = new Map();
  for (const row of requirementsResult.rows || []) {
    const key = String(row.venture_id);
    const list = requirementsByVenture.get(key);
    if (list) list.push(row);
    else requirementsByVenture.set(key, [row]);
  }

  const documentsByVenture = new Map();
  for (const row of documentsResult.rows || []) {
    const key = String(row.venture_id);
    const list = documentsByVenture.get(key);
    if (list) list.push(row);
    else documentsByVenture.set(key, [row]);
  }

  return ids.map((ventureId) => {
    const key = String(ventureId);
    const stage = stageByVenture.get(key);
    if (stage === undefined) return unknownRow(ventureId); // venture not readable

    // Stored levels win; otherwise the per-stage defaults, exactly as the
    // per-Venture seeding would have produced them.
    const stored = requirementsByVenture.get(key) || [];
    const requirements = stored.length > 0
      ? stored.map((row) => ({ category: row.category, level: row.level }))
      : defaultRequirements(stage);

    const completeness = computeDataRoomCompleteness(
      requirements,
      documentsByVenture.get(key) || [],
    );

    // Counts are per REQUIRED category (what the ✓ / ✕ / ◷ / … row means),
    // never per document: a category with three uploads is one requirement.
    const required = (completeness.requirements || []).filter((row) => row.level === "required");
    const countWith = (statuses) => required.filter((row) => statuses.includes(row.status)).length;

    return {
      venture_id: key,
      readiness_percent: completeness.readiness_percent,
      is_ready: completeness.is_ready,
      total_required: completeness.required_total,
      verified_count: countWith(["verified"]),
      rejected_count: countWith(["rejected"]),
      pending_count: countWith(["pending", "under_review", "uploaded"]),
      missing_count: countWith(["missing", "expired"]),
    };
  });
}

/**
 * Data Room completeness for ONE Venture — the same computation, through the
 * batch reader, so a single call and a list can never diverge.
 */
export async function getDataRoomReadiness(ventureRef) {
  if (!ventureRef) return null;
  const rows = await listDataRoomReadiness([ventureRef]);
  return rows[0] || null;
}

/**
 * The evidence behind the Venture's score, in one answer: for every REQUIRED
 * Data Room category, where it stands and which documents sit in it.
 *
 * Same rule as everywhere else (`computeDataRoomCompleteness`): only required
 * categories count, and only `verified` earns a point (1), anything else 0.
 * What this adds is the LIST — so the score can show its working:
 *   - `verified`           counted in the percentage now
 *   - `awaiting`           filed but not validated yet; will count once approved
 *   - `rejected`           filed and refused (earns nothing until re-filed and approved)
 *   - `missing`/`expired`  nothing usable on file
 *
 * A Venture with nothing required answers `percent: null` (not measurable —
 * never 0% and never 100%). A failed read answers `null`.
 */
export async function getRequiredEvidence(ventureRef) {
  if (!ventureRef) return null;
  const ids = await resolveVentureInternalIds([ventureRef]);
  const ventureId = ids?.[0];
  if (!ventureId) return null;

  const [stagesResult, requirementsResult, documentsResult] = await Promise.all([
    selectVentureStagesForVentures([ventureId]).catch(readFailure("stages")),
    selectDataRoomRequirementsForVentures([ventureId]).catch(readFailure("requirements")),
    selectDataRoomDocumentStatusesForVentures([ventureId]).catch(readFailure("documents")),
  ]);
  const stage = stagesResult.rows?.[0]?.business_stage;
  if (stage === undefined) return null;

  const stored = requirementsResult.rows || [];
  const requirements = stored.length > 0
    ? stored.map((row) => ({ category: row.category, level: row.level }))
    : defaultRequirements(stage);
  const documents = documentsResult.rows || [];
  const completeness = computeDataRoomCompleteness(requirements, documents);

  const awaitingStatuses = ["pending", "under_review", "uploaded"];
  const items = (completeness.requirements || [])
    .filter((row) => row.level === "required")
    .map((row) => {
      const status = awaitingStatuses.includes(row.status) ? "awaiting" : row.status;
      return {
        category: row.category,
        status,
        points: status === "verified" ? 1 : 0,
        documents: documents
          .filter((documentEntry) => documentEntry.category === row.category)
          .map((documentEntry) => ({
            id: documentEntry.id,
            title: documentEntry.title || null,
            status: awaitingStatuses.includes(documentEntry.status) ? "awaiting" : documentEntry.status,
          })),
      };
    });

  const count = (status) => items.filter((item) => item.status === status).length;
  return {
    percent: completeness.readiness_percent,
    required_total: completeness.required_total,
    verified_count: count("verified"),
    awaiting_count: count("awaiting"),
    rejected_count: count("rejected"),
    missing_count: count("missing") + count("expired"),
    items,
  };
}
