// =============================================================================
// KPI PROGRESS UTILITY
// Shared functions for recalculating and querying KPI progress.
// Used by API routes to avoid internal HTTP calls.
// =============================================================================
import db from "@/lib/db";

/**
 * Recalculates and stores KPI progress for a program.
 * Reads sessions + document requirements linked to each KPI,
 * computes progress, and upserts into kpi_progress table.
 */
export async function recalculateKpiProgress(programId) {
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
    const completedDocs = linkedDocs.filter((d) => d.is_completed).length;

    const totalItems = totalSessions + totalDocs;
    const completedItems = completedSessions + completedDocs;
    // Weight: equal distribution across all KPIs
    const weight =
      kpiList.length > 0 ? Math.round((100 / kpiList.length) * 100) / 100 : 0;
    const progress =
      totalItems > 0
        ? Math.round((completedItems / totalItems) * 10000) / 100
        : 0;

    return {
      kpi_id: kpi.id,
      program_id: programId,
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

  // 4. Upsert each entry into kpi_progress table
  for (const entry of progressEntries) {
    await db.execute({
      sql: `INSERT INTO kpi_progress (kpi_id, program_id, linked_sessions, completed_sessions, linked_docs, completed_docs, total_items, completed_items, progress, weight, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
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

  return progressEntries;
}
