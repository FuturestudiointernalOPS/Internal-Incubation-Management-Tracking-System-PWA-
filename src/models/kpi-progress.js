// =============================================================================
// OBJECTIVE PROGRESS UTILITY — APPROVED-ONLY, DELIVERABLE-WEIGHTED
// =============================================================================
// Only approved submissions count toward an objective. An objective's rate is
// the share of its linked deliverables that the programme's active participants
// had approved, each (participant × deliverable) pair counting once. Results are
// cached in kpi_progress for fast dashboard reads.
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
    const kpiRes = await db.execute({
      sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
      args: [programId],
    });
    const kpis = kpiRes.rows || [];
    if (kpis.length === 0) return [];

    // 2. Active participant base — canonical source: participant_programs
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
    // A single-participant recalculation (participantId given) measures one
    // person against the objective, so its base is 1 rather than the roster.
    const participantBase = participantId ? 1 : totalParticipants;

    // 3. Deliverables of the programme
    const docRes = await db.execute({
      sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ?",
      args: [programId],
    });

    // 4. Approved submissions. A submission may store the requirement id in
    // EITHER deliverable_id or document_id (the participant form writes both;
    // older flows wrote only one), so each row is reduced to a single
    // deliverable reference before counting — otherwise one approval could be
    // counted twice.
    let approvedQuery = `SELECT s.participant_id, s.deliverable_id, s.document_id
      FROM v2_submissions s
      WHERE s.program_id::text = ? AND s.status = 'approved'`;
    const approvedArgs = [programId];
    if (participantId) {
      approvedQuery += ` AND s.participant_id::text = ?`;
      approvedArgs.push(participantId);
    }
    const approvedRes = await db.execute({ sql: approvedQuery, args: approvedArgs });
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

    // 6. Replace the cache. Rows are written exactly as computed — no "never
    // downgrade to zero" guard: a rate that truly falls must be able to fall.
    // Non-measurable objectives are not written, and the previous rows are
    // cleared first so a removed objective (or one that lost its last
    // deliverable) cannot linger and skew the programme average.
    if (!participantId) {
      const measurableEntries = results.filter((entry) => entry.measurable);

      try {
        await db.execute({
          sql: "DELETE FROM kpi_progress WHERE program_id = ?",
          args: [String(programId)],
        });
      } catch (error) {
        console.warn("kpi_progress cache clear:", error.message);
      }

      if (measurableEntries.length > 0) {
        const cacheArgs = [];
        const values = measurableEntries.map((entry) => {
          cacheArgs.push(
            String(programId),
            String(entry.kpi_id),
            entry.title.substring(0, 255),
            entry.completion_rate,
            entry.participant_count,
            entry.approved_count,
          );
          return "(?, ?, ?, ?, ?, ?, NOW())";
        });

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

