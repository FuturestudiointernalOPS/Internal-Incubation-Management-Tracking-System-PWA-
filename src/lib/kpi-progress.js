// =============================================================================
// KPI PROGRESS UTILITY — APPROVED-ONLY, PARTICIPANT-WEIGHTED
// =============================================================================
// Only approved submissions count toward KPI completion.
// Results cached in kpi_progress table for fast dashboard reads.
// =============================================================================
import db from "@/lib/db";

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

    // 2. Total participant count
    const partRes = await db.execute({
      sql: "SELECT COUNT(*) AS count FROM v2_participants WHERE program_id::text = ? AND (status IS NULL OR status != 'archived')",
      args: [programId],
    });
    const totalParticipants = parseInt(partRes.rows[0]?.count) || 1;

    // 3. All deliverables for this program
    const docRes = await db.execute({
      sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ?",
      args: [programId],
    });

    // 4. Approved submissions (only these count)
    let approvedQuery = `SELECT s.*, d.kpi_ids FROM v2_submissions s
      JOIN v2_document_requirements d ON s.deliverable_id::text = d.id::text
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
        .filter((d) => {
          try {
            const ids = typeof d.kpi_ids === "string" ? JSON.parse(d.kpi_ids || "[]") : (d.kpi_ids || []);
            return ids.map(String).includes(kpiIdStr);
          } catch { return false; }
        })
        .map((d) => String(d.id));

      const approvedForKpi = approvedSubs.filter((s) =>
        linkedDocIds.includes(String(s.deliverable_id)),
      );
      const uniqueApproved = new Set(approvedForKpi.map((s) => s.participant_id)).size;
      const completionRate = Math.round((uniqueApproved / totalParticipants) * 100);

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

    // 6. Cache to kpi_progress table
    if (!participantId) {
      for (const r of results) {
        try {
          await db.execute({
            sql: `INSERT INTO kpi_progress (program_id, kpi_id, kpi_name, completion_rate, participant_count, approved_count, calculated_at)
                  VALUES (?, ?, ?, ?, ?, ?, NOW())
                  ON CONFLICT (program_id, kpi_id) DO UPDATE SET
                  kpi_name = EXCLUDED.kpi_name,
                  completion_rate = EXCLUDED.completion_rate,
                  participant_count = EXCLUDED.participant_count,
                  approved_count = EXCLUDED.approved_count,
                  calculated_at = NOW()`,
            args: [String(programId), r.kpi_id, r.title.substring(0, 255), r.completion_rate, totalParticipants, r.approved_count],
          });
        } catch (e) {
          console.warn("kpi_progress cache write:", e.message);
        }
      }
    }

    return results;
  } catch (e) {
    console.error("recalculateKpiProgress error:", e.message);
    return [];
  }
}

/**
 * Fetch cached KPI progress for fast dashboard reads.
 */
export async function getCachedKpiProgress(programId) {
  try {
    const res = await db.execute({
      sql: `SELECT kp.*, k.title, k.weight, k.target_value, k.auto_weight
            FROM kpi_progress kp
            JOIN v2_kpis k ON kp.kpi_id = k.id
            WHERE kp.program_id = ? AND k.program_id::text = ?`,
      args: [programId, programId],
    });
    return res.rows || [];
  } catch {
    return [];
  }
}
