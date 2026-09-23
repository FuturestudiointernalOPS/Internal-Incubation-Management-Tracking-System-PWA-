// =============================================================================
// KPI PROGRESS UTILITY — APPROVED-ONLY, PARTICIPANT-WEIGHTED
// =============================================================================
// Only approved submissions count toward KPI completion.
// Results cached in kpi_progress table for fast dashboard reads.
// =============================================================================
import db from "@/lib/db";

/**
 * The names of the KPIs belonging to the given programs.
 *
 * One query for as many programs as are asked about, so a screen that has to name
 * the KPIs cited by a list of reports does not ask once per program - and, being a
 * plain catalogue read, it never triggers the recalculation that the per-program
 * progress read performs when it finds no cached row.
 */
export async function listKpiNamesForPrograms(programIds) {
  const programIdsList = [
    ...new Set(
      (programIds || [])
        .filter((id) => id !== null && id !== undefined)
        .map((id) => String(id)),
    ),
  ];
  if (programIdsList.length === 0) return { rows: [] };

  const placeholders = programIdsList.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT id, title, program_id FROM v2_kpis
          WHERE program_id::text IN (${placeholders})`,
    args: programIdsList,
  });
}

/**
 * Recalculate KPI progress for a program.
 * Counts unique participants with APPROVED submissions per KPI-linked deliverable.
 * Caches results in kpi_progress table.
 */
export async function recalculateKpiProgress(programId, participantId) {
  try {
    // 1. Fetch KPIs with weights
    const kpiRes = await db.execute({
      sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
      args: [programId],
    });
    const kpis = kpiRes.rows || [];
    if (kpis.length === 0) return [];

    // 2. Total participant count — canonical source: participant_programs
    // membership + active contacts, matching /api/participants and the PM
    // full-state. v2_participants is intake/history only and may be empty or
    // hold duplicates, which made the rate collapse to 0 / inflate wrongly.
    const partRes = await db.execute({
      sql: `SELECT COUNT(*) AS count
            FROM participant_programs pp
            JOIN contacts c ON pp.participant_id = c.cid
            WHERE CAST(pp.program_id AS TEXT) = ?
              AND c.deleted = 0 AND c.deleted_at IS NULL AND c.archived_at IS NULL
              AND LOWER(COALESCE(c.status, '')) = 'active'
              AND NOT EXISTS (
                SELECT 1 FROM v2_program_staff ps
                WHERE CAST(ps.program_id AS TEXT) = ?
                  AND ps.role = 'facilitator'
                  AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
              )`,
      args: [String(programId), String(programId)],
    });
    const totalParticipants = parseInt(partRes.rows[0]?.count) || 0;

    // 3. All deliverables for this program
    const docRes = await db.execute({
      sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ?",
      args: [programId],
    });

    // 4. Approved submissions (only these count). Submissions may store the
    // requirement id in EITHER deliverable_id or document_id (the participant
    // form writes both; older flows wrote only one), so join on both.
    let approvedQuery = `SELECT s.*, d.kpi_ids FROM v2_submissions s
      JOIN v2_document_requirements d
        ON s.deliverable_id::text = d.id::text OR s.document_id::text = d.id::text
      WHERE s.program_id::text = ? AND s.status = 'approved'`;
    const approvedArgs = [programId];
    if (participantId) {
      approvedQuery += ` AND s.participant_id::text = ?`;
      approvedArgs.push(participantId);
    }
    const approvedRes = await db.execute({ sql: approvedQuery, args: approvedArgs });
    const approvedSubs = approvedRes.rows || [];

    // 5. Per KPI: count unique participants with approved work
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

      const approvedForKpi = approvedSubs.filter(
        (submission) =>
          linkedDocIds.includes(String(submission.deliverable_id)) ||
          linkedDocIds.includes(String(submission.document_id)),
      );
      const uniqueApproved = new Set(approvedForKpi.map((submission) => submission.participant_id)).size;
      const completionRate =
        totalParticipants > 0
          ? Math.min(100, Math.round((uniqueApproved / totalParticipants) * 100))
          : 0;

      return {
        kpi_id: kpi.id,
        program_id: programId,
        title: kpi.title,
        weight: parseFloat(kpi.weight) || 0,
        completion_rate: completionRate,
        approved_count: uniqueApproved,
        participant_count: totalParticipants,
      };
    });

    // 6. Cache to kpi_progress table. Never downgrade a previously recorded
    // non-zero rate to 0 because a recalc ran at a moment when no approved
    // submission was found (e.g. mid-week, before reviews) — that wiped good
    // progress for the PM and super admin dashboards.
    if (!participantId) {
      let prevRates = new Map();
      try {
        const prevRes = await db.execute({
          sql: "SELECT kpi_id, completion_rate FROM kpi_progress WHERE program_id = ?",
          args: [String(programId)],
        });
        prevRates = new Map(
          (prevRes.rows || []).map((cachedRow) => [
            String(cachedRow.kpi_id),
            parseFloat(cachedRow.completion_rate) || 0,
          ]),
        );
      } catch (_) {}

      // ONE multi-row upsert instead of one statement per indicator. The values
      // are still computed per indicator above, so the "never downgrade to 0"
      // rule is unchanged; only the number of round trips changes (N → 1).
      const cacheArgs = [];
      const values = results.map((progressEntry) => {
        const prevRate = prevRates.get(String(progressEntry.kpi_id)) || 0;
        const rate = progressEntry.completion_rate > 0 || prevRate <= 0 ? progressEntry.completion_rate : prevRate;
        cacheArgs.push(
          String(programId),
          String(progressEntry.kpi_id),
          progressEntry.title.substring(0, 255),
          rate,
          totalParticipants,
          progressEntry.approved_count,
        );
        return "(?, ?, ?, ?, ?, ?, NOW())";
      });

      if (values.length > 0) {
        try {
          await db.execute({
            sql: `INSERT INTO kpi_progress (program_id, kpi_id, kpi_name, completion_rate, participant_count, approved_count, calculated_at)
                  VALUES ${values.join(", ")}
                  ON CONFLICT (program_id, kpi_id) DO UPDATE SET
                  kpi_name = EXCLUDED.kpi_name,
                  completion_rate = EXCLUDED.completion_rate,
                  participant_count = EXCLUDED.participant_count,
                  approved_count = EXCLUDED.approved_count,
                  calculated_at = NOW()`,
            args: cacheArgs,
          });
        } catch (error) {
          // The cache write is best-effort: the freshly computed values are still
          // returned to the caller (the original behaviour, kept deliberately).
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
    const lastRes = await db.execute({
      sql: "SELECT MAX(calculated_at) AS last FROM kpi_progress WHERE program_id = ?",
      args: [String(programId)],
    });
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

/**
 * Fetch cached KPI progress for fast dashboard reads.
 */
export async function getCachedKpiProgress(programId) {
  try {
    const result = await db.execute({
      sql: `SELECT kp.*, k.title, k.weight, k.target_value, k.auto_weight
            FROM kpi_progress kp
            JOIN v2_kpis k ON kp.kpi_id::text = k.id::text
            WHERE kp.program_id = ? AND k.program_id::text = ?`,
      args: [programId, programId],
    });
    return result.rows || [];
  } catch {
    return [];
  }
}
