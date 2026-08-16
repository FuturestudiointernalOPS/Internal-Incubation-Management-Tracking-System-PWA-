import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, requireProgramFacilitator } from "@/lib/auth";
import { recalculateKpiProgress } from "@/lib/kpi-progress";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "facilitator",
    ]);
    if (authError) return authError;
    // Facilitators must be assigned to this program before seeing its data
    if (requireProgramFacilitator) {
      const { searchParams: sp } = new URL(req.url);
      const progId = sp.get("id");
      if (progId) {
        const session = await getSession();
        if (session?.role === "facilitator") {
          const guardError = await requireProgramFacilitator(progId);
          if (guardError) return guardError;
        }
      }
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const includeMetrics = searchParams.get("metrics") === "true";

    if (!id) return NextResponse.json({ success: false, error: "ID required" });

    const queries = [
      {
        name: "program",
        sql: `SELECT p.*, k.title as note_title, k.url as note_files, k.description as note_description, c.name as pm_name, NULL as completion_index FROM v2_programs p LEFT JOIN v2_knowledge_bank k ON CAST(p.note_id AS TEXT) = CAST(k.id AS TEXT) LEFT JOIN contacts c ON p.assigned_pm_id = c.cid WHERE p.id = ?`,
        args: [id],
      },
      {
        name: "participants_v2",
        sql: `SELECT CAST(id AS TEXT) as id, user_id, program_id, name, email, phone, screening_status, status, created_at, 'MANUAL' as group_name, 'manual' as source, v2_team_id FROM v2_participants WHERE program_id = ? AND (status IS NULL OR status != 'archived')`,
        args: [id],
      },
      {
        name: "participants_contacts",
        sql: `SELECT CAST(cid AS TEXT) as id, program_id, name, email, phone, 'approved' as screening_status, status, created_at, group_name, 'group' as source, v2_team_id FROM contacts WHERE program_id IS NOT NULL AND program_id != '' AND status != 'archived' AND (program_id = ? OR program_id LIKE ? OR UPPER(TRIM(group_name)) IN (SELECT UPPER(TRIM(name)) FROM families WHERE program_id = ?))`,
        args: [id, `%${id}%`, id],
      },
      {
        // People enrolled through form-run approvals (and re-linked identities)
        // live in participant_programs — the junction of record. Without this
        // source, form-enrolled participants never appear on the program.
        name: "participants_enrolled",
        sql: `SELECT CAST(c.cid AS TEXT) as id, pp.program_id, c.name, c.email, c.phone, 'approved' as screening_status, c.status, c.created_at, c.group_name, 'enrolled' as source, c.v2_team_id
              FROM participant_programs pp
              JOIN contacts c ON pp.participant_id = c.cid
              WHERE CAST(pp.program_id AS TEXT) = ? AND c.deleted = 0 AND c.deleted_at IS NULL`,
        args: [String(id)],
      },
      {
        name: "teams",
        sql: "SELECT * FROM v2_teams WHERE program_id = ?",
        args: [id],
      },
      {
        name: "sessions",
        sql: "SELECT * FROM v2_sessions WHERE program_id = ? AND (status IS NULL OR status != 'archived')",
        args: [id],
      },
      {
        name: "staffList",
        sql: "SELECT cid, name, email, phone, role FROM contacts WHERE role IN ('teacher', 'staff', 'admin') AND deleted = 0",
        args: [],
      },
      {
        name: "events",
        sql: "SELECT * FROM v2_events WHERE program_id = ?",
        args: [id],
      },
      {
        name: "kpis",
        sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
        args: [id],
      },
      {
        name: "documents",
        sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?",
        args: [id],
      },
      {
        name: "followups",
        sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC",
        args: [id],
      },
      {
        name: "assignedStaff",
        sql: `SELECT ps.id, c.cid, c.name, c.email, ps.role FROM v2_program_staff ps LEFT JOIN contacts c ON ps.staff_id = c.cid OR LOWER(TRIM(c.email)) = LOWER(TRIM(ps.staff_id)) WHERE ps.program_id = ?`,
        args: [id],
      },
      {
        name: "submissions",
        sql: `SELECT s.*, 
                     COALESCE(c.name, vp.name) as participant_name, 
                     d.title as deliverable_title
              FROM v2_submissions s
              LEFT JOIN contacts c ON s.participant_id::text = c.cid
              LEFT JOIN v2_participants vp ON s.participant_id::text = vp.id::text
              LEFT JOIN v2_document_requirements d ON s.deliverable_id::text = d.id::text
              WHERE s.program_id::text = ?`,
        args: [id],
      },
      {
        name: "reports",
        sql: "SELECT * FROM v2_weekly_reports WHERE program_id = ? ORDER BY week_number DESC",
        args: [id],
      },
      {
        name: "families",
        sql: "SELECT * FROM families WHERE program_id = ?",
        args: [id],
      },
      {
        name: "deliverables",
        sql: "SELECT * FROM v2_deliverables WHERE program_id = ? ORDER BY week_number ASC",
        args: [id],
      },
    ];

    const results = await Promise.all(
      queries.map(async (q) => {
        try {
          return await db.execute({ sql: q.sql, args: q.args });
        } catch (e) {
          console.error(` forensic | Query [${q.name}] failed:`, e.message);
          return { rows: [] };
        }
      }),
    );

    const [
      progRes,
      parRes,
      contRes,
      enrRes,
      teamRes,
      sesRes,
      staffRes,
      eventRes,
      kpiRes,
      docRes,
      folRes,
      assignedStaffRes,
      subRes,
      repRes,
      famRes,
      delRes,
    ] = results;

    const program = progRes.rows[0];
    if (program) {
      try {
        // Defensive: materials may be double-stringified from older saves
        if (typeof program.materials === "string") {
          let parsed = program.materials;
          // Try to parse up to 4 levels of nesting
          for (let i = 0; i < 4; i++) {
            try {
              const p = JSON.parse(parsed);
              if (Array.isArray(p)) { parsed = p; break; }
              parsed = p;
            } catch { break; }
          }
          program.materials = Array.isArray(parsed) ? parsed : [];
        } else {
          program.materials = Array.isArray(program.materials) ? program.materials : [];
        }

        if (
          typeof program.note_files === "string" &&
          program.note_files.trim()
        ) {
          try {
            program.note_files = JSON.parse(program.note_files);
          } catch (e) {
            let value = program.note_files;
            let parsed = false;
            for (let i = 0; i < 3; i++) {
              try {
                value = JSON.parse(value);
                parsed = true;
              } catch {
                break;
              }
            }
            program.note_files = parsed && Array.isArray(value) ? value : [];
          }
        } else {
          program.note_files = program.note_files || [];
        }
        if (Array.isArray(program.note_files)) {
          program.note_files = program.note_files.map((f) => {
            if (typeof f === "object" && f !== null) {
              return {
                name: f.name || f.NAME || f.title || f.TITLE || "",
                url: f.url || f.URL || f.path || "",
                ...f,
              };
            }
            if (typeof f === "string") return { name: f, url: f };
            return f;
          });
        }

        if (program.note_id) {
          const kbAttachmentsRes = await db.execute({
            sql: "SELECT name, url FROM v2_knowledge_attachments WHERE CAST(note_id AS TEXT) = CAST(? AS TEXT)",
            args: [program.note_id],
          });
          program.knowledge_assets = kbAttachmentsRes.rows;
        } else {
          program.knowledge_assets = [];
        }

        const sessions = sesRes.rows || [];
        const documents = docRes.rows || [];
        const reports = repRes.rows || [];

        const totalSessions = sessions.length;
        const completedSessions = sessions.filter(
          (s) => s.status === "completed",
        ).length;
        const totalDocs = documents.length;
        const completedDocs = documents.filter((d) => d.is_completed).length;
        const uniqueReportWeeks = new Set(reports.map((r) => r.week_number))
          .size;

        const totalPoints =
          totalSessions * 5.0 +
          totalDocs * 2.0 +
          (program.duration_weeks || 13) * 10.0;
        const completedPoints =
          completedSessions * 5.0 +
          completedDocs * 2.0 +
          uniqueReportWeeks * 10.0;

        program.completion_index =
          totalPoints > 0 ? (completedPoints / totalPoints) * 100.0 : 0;
      } catch (e) {
        program.materials = [];
        program.knowledge_assets = [];
        program.completion_index = 0;
      }
    }

    let assignedStaff = assignedStaffRes.rows;
    // Dedupe (cid+email OR-match can produce duplicates)
    assignedStaff = Array.from(
      new Map((assignedStaff || []).map((r) => [r.id ?? r.cid ?? r.staff_id, r])).values(),
    );
    // Never show a bare id where a name is expected — fall back to email
    assignedStaff = (assignedStaff || []).map((r) => ({
      ...r,
      name: r.name || r.email || r.staff_id,
    }));
    let programFacilitators = [];

    // External facilitators (role='facilitator') are NOT internal staff —
    // keep them out of staffList so they never appear in staff workflows.
    if (Array.isArray(assignedStaff)) {
      programFacilitators = assignedStaff.filter(
        (r) => String(r.role || "").toLowerCase() === "facilitator",
      );
      assignedStaff = assignedStaff.filter(
        (r) => String(r.role || "").toLowerCase() !== "facilitator",
      );
    }

    if (program?.assigned_assistant_id) {
      try {
        const assistantIds = JSON.parse(program.assigned_assistant_id);
        if (Array.isArray(assistantIds) && assistantIds.length > 0) {
          const assistantsRes = await db.execute({
            sql: `SELECT cid, name, email, phone, role FROM contacts WHERE cid IN (${assistantIds.map(() => "?").join(",")})`,
            args: assistantIds,
          });
          const merged = [...assignedStaff, ...assistantsRes.rows];
          assignedStaff = Array.from(
            new Map(merged.map((item) => [item.cid, item])).values(),
          );
        }
      } catch (e) {}
    }

    // --- MERGE PARTICIPANTS (always) ---
    // Sources: v2_participants (manual registry), contacts by program/group,
    // and contacts enrolled via participant_programs (form approvals).
    // Dedupe by lowercase email so one contact = one participant row.
    const allParticipantRows = [...parRes.rows, ...contRes.rows, ...enrRes.rows];
    const mergedParticipants = Array.from(
      new Map(
        allParticipantRows
          .filter((p) => p.email)
          .map((p) => [p.email.toLowerCase(), p]),
      ).values(),
    );

    // --- OPTIONAL METRICS (only when ?metrics=true) ---
    let kpisWithProgress = kpiRes.rows || [];
    let uniqueParticipants = mergedParticipants;
    let operationalProgress = program?.completion_index || 0;
    let submissionRate = 0,
      approvalRate = 0;
    let expectedSubmissions = 0,
      actualSubmissions = 0,
      approvedSubmissions = 0;
    let totalParticipants = 0,
      overallHealth = 0;

    if (includeMetrics) {
      const kpiList = kpiRes.rows || [];
      const subList = subRes.rows || [];

      // ─── PERSISTED KPI PROGRESS ───
      // Read from kpi_progress table (pre-calculated, updated on session/doc changes)
      try {
        const progressRes = await db.execute({
          sql: "SELECT * FROM kpi_progress WHERE program_id = ? ORDER BY kpi_id ASC",
          args: [id],
        });
        const persistedProgress = progressRes.rows || [];

        if (persistedProgress.length > 0) {
          // Merge persisted progress with KPI metadata
          kpisWithProgress = kpiList.map((kpi) => {
            const p = persistedProgress.find(
              (pp) => String(pp.kpi_id) === String(kpi.id),
            );
            return {
              ...kpi,
              progress: p ? parseFloat(p.progress) : 0,
              weight: p ? parseFloat(p.weight) : 0,
              linkedSessions: p ? p.linked_sessions : 0,
              completedSessions: p ? p.completed_sessions : 0,
              linkedDocs: p ? p.linked_docs : 0,
              completedDocs: p ? p.completed_docs : 0,
            };
          });
        } else {
          // Fallback: calculate dynamically (first time, no persisted data yet)
          const sessionList = sesRes.rows || [];
          const docList = docRes.rows || [];

          kpisWithProgress = kpiList.map((kpi) => {
            const kpiId = String(kpi.id);
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

            return {
              ...kpi,
              progress:
                linkedSessions.length + linkedDocs.length > 0
                  ? Math.round(
                      ((linkedSessions.filter((s) => s.status === "completed")
                        .length +
                        linkedDocs.filter((d) => d.is_completed).length) /
                        (linkedSessions.length + linkedDocs.length)) *
                        100,
                    )
                  : 0,
              weight: kpiList.length > 0 ? Math.round(100 / kpiList.length) : 0,
              linkedSessions: linkedSessions.length,
              completedSessions: linkedSessions.filter(
                (s) => s.status === "completed",
              ).length,
              linkedDocs: linkedDocs.length,
              completedDocs: linkedDocs.filter((d) => d.is_completed).length,
            };
          });

          // Fire-and-forget: persist this calculation for next time
          recalculateKpiProgress(id).catch(() => {});
        }
      } catch (e) {
        console.warn(
          "kpi_progress table not available, falling back to dynamic calc:",
          e.message,
        );
        // Fallback: calculate dynamically
        const sessionList = sesRes.rows || [];
        const docList = docRes.rows || [];
        kpisWithProgress = kpiList.map((kpi) => {
          const kpiId = String(kpi.id);
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
          return {
            ...kpi,
            progress:
              linkedSessions.length + linkedDocs.length > 0
                ? Math.round(
                    ((linkedSessions.filter((s) => s.status === "completed")
                      .length +
                      linkedDocs.filter((d) => d.is_completed).length) /
                      (linkedSessions.length + linkedDocs.length)) *
                      100,
                  )
                : 0,
            weight: kpiList.length > 0 ? Math.round(100 / kpiList.length) : 0,
            linkedSessions: linkedSessions.length,
            completedSessions: linkedSessions.filter(
              (s) => s.status === "completed",
            ).length,
            linkedDocs: linkedDocs.length,
            completedDocs: linkedDocs.filter((d) => d.is_completed).length,
          };
        });
      }

      const allParticipantRows = [...parRes.rows, ...contRes.rows];
      uniqueParticipants = Array.from(
        new Map(
          allParticipantRows
            .filter((p) => p.email)
            .map((p) => [p.email.toLowerCase(), p]),
        ).values(),
      );

      totalParticipants = uniqueParticipants.length;
      const docList = docRes.rows || [];
      expectedSubmissions = totalParticipants * docList.length;
      actualSubmissions = subList.length;
      approvedSubmissions = subList.filter(
        (s) => s.status === "approved",
      ).length;
      submissionRate =
        expectedSubmissions > 0
          ? Math.round((actualSubmissions / expectedSubmissions) * 100)
          : 0;
      approvalRate =
        actualSubmissions > 0
          ? Math.round((approvedSubmissions / actualSubmissions) * 100)
          : 0;
      operationalProgress =
        kpisWithProgress.length > 0
          ? Math.round(
              kpisWithProgress.reduce((sum, k) => sum + (k.progress || 0), 0) /
                kpisWithProgress.length,
            )
          : program?.completion_index || 0;
      overallHealth = Math.round((operationalProgress + approvalRate) / 2);
    }

    return NextResponse.json({
      success: true,
      program,
      participants: uniqueParticipants,
      teams: teamRes.rows,
      sessions: sesRes.rows,
      staffList: staffRes.rows,
      events: eventRes.rows,
      kpis: kpisWithProgress,
      documents: docRes.rows,
      followups: folRes.rows,
      assignedStaff,
      facilitators: programFacilitators,
      submissions: subRes.rows,
      reports: repRes.rows,
      families: famRes.rows,
      deliverables: delRes.rows,
      metrics: includeMetrics
        ? {
            operational: {
              progress: operationalProgress,
              kpis: kpisWithProgress.map((k) => ({
                id: k.id,
                title: k.title,
                progress: k.progress,
                weight: k.weight,
              })),
            },
            student: {
              submissionRate,
              approvalRate,
              expectedSubmissions,
              actualSubmissions,
              approvedSubmissions,
              totalParticipants,
            },
            overallHealth,
          }
        : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
