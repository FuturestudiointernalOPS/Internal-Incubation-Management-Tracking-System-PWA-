// =============================================================================
// OBJECTIVE PROGRESS — APPROVED-ONLY, DELIVERABLE-WEIGHTED (SERVICE layer)
// =============================================================================
// Only approved submissions count toward an objective. An objective's rate is
// the share of its linked deliverables that the programme's active participants
// had approved, each (participant × deliverable) pair counting once. Results are
// cached in kpi_progress for fast dashboard reads.
//
// Layer (see docs/LAYER_SPLIT.md): the rate computation and the cache policy
// live here; every statement lives in `@/models/kpiProgressStore`.
// =============================================================================

import {
  listKpisForProgram,
  countActiveParticipants,
  listDocumentRequirements,
  listApprovedSubmissions,
  clearKpiProgressCache,
  insertKpiProgressRows,
  getLastKpiCalculatedAt,
} from "@/models/kpiProgressStore";

/**
 * Recalculate objective progress for a programme.
 *
 * An objective's rate is the share of its expected approved deliverables that
 * participants actually had approved:
 *
 *   approved (participant × deliverable) pairs, counted once each
 *   ─────────────────────────────────────────────────────────────── × 100
 *             active participants × linked deliverables
 *
 * A participant who got 2 of an objective's 3 linked deliverables approved
 * therefore contributes 2/3 — not 0, not 1. Only approved submissions count;
 * sessions never do. An objective with no linked deliverable has no expected
 * work to measure: it is reported as not measurable and is never cached, so it
 * is left out of the programme average rather than reading as 0 %.
 *
 * The cache always reflects the latest calculation, including a drop back to
 * zero, and is replaced wholesale on each run so a removed objective cannot
 * leave a stale row behind.
 */
export async function recalculateKpiProgress(programId, participantId) {
  try {
    // 1. Objectives of the programme
    const kpiRes = await listKpisForProgram(programId);
    const kpis = kpiRes.rows || [];
    if (kpis.length === 0) return [];

    // 2. Active participant base.
    const partRes = await countActiveParticipants(programId);
    const totalParticipants = parseInt(partRes.rows[0]?.count) || 0;
    // A single-participant recalculation (participantId given) measures one
    // person against the objective, so its base is 1 rather than the roster.
    const participantBase = participantId ? 1 : totalParticipants;

    // 3. Deliverables of the programme
    const docRes = await listDocumentRequirements(programId);

    // 4. Approved submissions (reduced to one deliverable reference per row).
    const approvedRes = await listApprovedSubmissions(programId, participantId);
    const approvedSubs = approvedRes.rows || [];

    // 5. Per objective: count the approved (participant × deliverable) pairs.
    const results = kpis.map((kpi) => {
      const kpiIdStr = String(kpi.id);
      const linkedDocIds = docRes.rows
        .filter((documentRequirement) => {
          try {
            const requirementKpiIds = typeof documentRequirement.kpi_ids === "string" ? JSON.parse(documentRequirement.kpi_ids || "[]") : (documentRequirement.kpi_ids || []);
            return requirementKpiIds.map(String).includes(kpiIdStr);
          } catch { return false; }
        })
        .map((documentRequirement) => String(documentRequirement.id));

      const measurable = linkedDocIds.length > 0;
      let approvedCount = 0;
      if (measurable) {
        const countedPairs = new Set();
        for (const submission of approvedSubs) {
          const deliverableId = String(
            submission.deliverable_id ?? submission.document_id ?? "",
          );
          if (!deliverableId || !linkedDocIds.includes(deliverableId)) continue;
          const pairKey = `${submission.participant_id}::${deliverableId}`;
          if (countedPairs.has(pairKey)) continue;
          countedPairs.add(pairKey);
          approvedCount += 1;
        }
      }
      const expected = participantBase * linkedDocIds.length;
      const completionRate =
        measurable && expected > 0
          ? Math.min(100, Math.round((approvedCount / expected) * 100))
          : 0;

      return {
        kpi_id: kpi.id,
        program_id: programId,
        title: kpi.title,
        completion_rate: completionRate,
        approved_count: approvedCount,
        participant_count: participantBase,
        measurable,
      };
    });

    // 6. Replace the cache. Non-measurable objectives are not written, and the
    // previous rows are cleared first so a removed objective (or one that lost
    // its last deliverable) cannot linger and skew the programme average.
    if (!participantId) {
      const measurableEntries = results.filter((entry) => entry.measurable);

      try {
        await clearKpiProgressCache(programId);
      } catch (error) {
        console.warn("kpi_progress cache clear:", error.message);
      }

      if (measurableEntries.length > 0) {
        try {
          await insertKpiProgressRows(programId, measurableEntries);
        } catch (error) {
          // The cache write is best-effort: the freshly computed values are still
          // returned to the caller.
          console.warn("kpi_progress cache write:", error.message);
        }
      }
    }

    return results;
  } catch (error) {
    console.error("recalculateKpiProgress error:", error.message);
    return [];
  }
}

/**
 * How long a persisted KPI progress may be reused before it is recalculated.
 *
 * Approvals and requirement edits recalculate immediately (their routes call
 * recalculateKpiProgress directly) — this window only covers the read path,
 * where a page view used to trigger a full recalculation and its writes every
 * single time.
 */
export const KPI_PROGRESS_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * How often, per process, this may even ASK whether a program's progress is
 * stale.
 *
 * The read path calls this on every metrics load. The question is one cheap read,
 * but it is still a round trip per load — and a background one, so it competes
 * for the same limited connections the response itself needs. Asking at most once
 * per window per program keeps the safety net (the TTL above still decides
 * whether anything is recalculated) while removing that per-load round trip. The
 * worst case is that a genuinely stale figure lingers one extra window.
 */
const KPI_PROGRESS_CHECK_INTERVAL_MS = 30 * 1000;
const lastStaleCheckAt = new Map();

/**
 * Recalculate ONLY when the persisted progress is older than `maxAgeMs`.
 *
 * A page load must not systematically trigger a write-heavy recalculation: this
 * asks one cheap question first (when was this program last calculated?) and
 * returns without touching anything when the answer is recent. Anything that
 * changes the numbers itself recalculates directly, so the window only bounds
 * how long an unnoticed background change can go unrefreshed.
 *
 * @returns {{ skipped: boolean, entries?: Array, calculatedAt?: string|null }}
 */
export async function refreshKpiProgressIfStale(
  programId,
  maxAgeMs = KPI_PROGRESS_MAX_AGE_MS,
) {
  const key = String(programId);
  const now = Date.now();
  if (now - (lastStaleCheckAt.get(key) || 0) < KPI_PROGRESS_CHECK_INTERVAL_MS) {
    return { skipped: true, calculatedAt: null };
  }
  // Recorded before the check, so a failed read is not retried until the next
  // window (a broken statement must not become a per-load retry storm).
  lastStaleCheckAt.set(key, now);
  try {
    const lastRes = await getLastKpiCalculatedAt(programId);
    const lastCalculatedAt = lastRes.rows?.[0]?.last || null;
    const lastCalculatedMs = lastCalculatedAt ? new Date(lastCalculatedAt).getTime() : 0;
    if (lastCalculatedMs && Date.now() - lastCalculatedMs < maxAgeMs) {
      return { skipped: true, calculatedAt: lastCalculatedAt };
    }
    const entries = await recalculateKpiProgress(programId);
    return { skipped: false, entries, calculatedAt: lastCalculatedAt };
  } catch (error) {
    console.warn("refreshKpiProgressIfStale:", error.message);
    return { skipped: true, calculatedAt: null };
  }
}
