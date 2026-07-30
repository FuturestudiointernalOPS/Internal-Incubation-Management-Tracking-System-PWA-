// =============================================================================
// KPI PROGRESS UTILITY
// Shared functions for recalculating and querying KPI progress.
// Used by API routes to avoid internal HTTP calls.
// =============================================================================
import db from "@/lib/db";

/**
 * Recalculates and stores KPI progress for a program.
 * If participantId is provided, calculates progress for that specific participant
 * by checking their approved submissions against document requirements.
 * Otherwise, calculates global progress based on session/doc completion status.
 */
export async function recalculateKpiProgress(programId, participantId) {
  // 1. Fetch KPIs for this program
  const kpiRes = await db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
    args: [programId],
  });
  const kpiList = kpiRes.rows || [];

  if (kpiList.length === 0) return [];

  // 2. Fetch all sessions and document requirements for this program
  const [sessionRes, docRes] = await Promise.all([
    db.execute({
      sql: "SELECT * FROM v2_sessions WHERE program_id = ?",
      args: [programId],
    }),
    db.execute({
      sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?",
      args: [programId],
    }),
  ]);

  const sessionList = sessionRes.rows || [];
  const docList = docRes.rows || [];

  // Fetch participant submissions if per-participant progress requested
  let participantSubmissions = [];
  if (participantId) {
    try {
      const subRes = await db.execute({
        sql: `SELECT s.* FROM v2_submissions s
              LEFT JOIN v2_participants p ON s.participant_id = p.id
              WHERE (s.participant_id::text = ? OR p.email = ? OR p.user_id = ?)
              AND s.program_id = ? AND s.status = 'approved'`,
        args: [participantId, participantId, participantId, programId],
      });
      participantSubmissions = subRes.rows || [];
    } catch (_) {}
  }

  // 3. Calculate progress for each KPI
  const progressEntries = kpiList.map((kpi) => {
    const kpiId = String(kpi.id);

    // Find linked sessions
    const linkedSessions = sessionList.filter((s) => {
      try {
        const ids =
          typeof s.kpi_ids === "string"
            ? JSON.parse(s.kpi_ids)
            : s.kpi_ids || [];
        return ids.map(String).includes(kpiId);
      } catch {
        return false;
      }
    });

    // Find linked document requirements
    const linkedDocs = docList.filter((d) => {
      try {
        const ids =
          typeof d.kpi_ids === "string"
            ? JSON.parse(d.kpi_ids)
            : d.kpi_ids || [];
        return ids.map(String).includes(kpiId);
      } catch {
        return false;
      }
    });

    const totalSessions = linkedSessions.length;
    const completedSessions = linkedSessions.filter(
      (s) => s.status === "completed",
    ).length;
    const totalDocs = linkedDocs.length;
    let completedDocs;
    if (participantId && participantSubmissions.length > 0) {
      // Per-participant: check if they have approved submissions for linked docs
      completedDocs = linkedDocs.filter((d) =>
        participantSubmissions.some(
          (s) => (s.deliverable_id || s.document_id) === d.id,
        ),
      ).length;
    } else {
      // Global: check document requirement completion flag
      completedDocs = linkedDocs.filter((d) => d.is_completed).length;
    }

    const totalItems = totalSessions + totalDocs;
    const completedItems = completedSessions + completedDocs;
    // Weight: equal distribution across all KPIs
    const weight =
      kpiList.length > 0 ? Math.round(100 / kpiList.length) : 0;
    const progress =
      totalItems > 0
        ? Math.round((completedItems / totalItems) * 100)
        : 0;

    return {
      kpi_id: kpi.id,
      program_id: programId,
      kpi_name: kpi.title,
      linked_sessions: totalSessions,
      completed_sessions: completedSessions,
      linked_docs: totalDocs,
      completed_docs: completedDocs,
      total_items: totalItems,
      completed_items: completedItems,
      progress,
      weight,
    };
  });

  // 4. Upsert each entry into kpi_progress table (only for global progress, not per-participant)
  if (!participantId) {
    try {
    for (const entry of progressEntries) {
      await db.execute({
        sql: `INSERT INTO kpi_progress (kpi_id, program_id, kpi_name, linked_sessions, completed_sessions, linked_docs, completed_docs, total_items, completed_items, progress, weight, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
              ON CONFLICT (kpi_id, program_id)
              DO UPDATE SET
                linked_sessions = EXCLUDED.linked_sessions,
                completed_sessions = EXCLUDED.completed_sessions,
                linked_docs = EXCLUDED.linked_docs,
                completed_docs = EXCLUDED.completed_docs,
                total_items = EXCLUDED.total_items,
                completed_items = EXCLUDED.completed_items,
                progress = EXCLUDED.progress,
                weight = EXCLUDED.weight,
                updated_at = NOW()`,
        args: [
          entry.kpi_id,
          entry.program_id,
          entry.kpi_name,
          entry.linked_sessions,
          entry.completed_sessions,
          entry.linked_docs,
          entry.completed_docs,
          entry.total_items,
          entry.completed_items,
          entry.progress,
          entry.weight,
        ],
      });
    }
  } catch (e) {
    // kpi_progress schema mismatch, see SCHEMA_DRIFT_AUDIT.md cluster 11
    console.warn("kpi_progress write failed:", e.message);
    return [];
  }
  } // end if (!participantId)

  return progressEntries;
}
