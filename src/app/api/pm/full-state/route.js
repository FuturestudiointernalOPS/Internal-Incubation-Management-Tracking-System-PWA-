import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ success: false, error: "ID required" });

    // Granular Forensic Execution
    const queries = [
      {
        name: "program",
        sql: `SELECT p.*, k.title as note_title, k.url as note_files, k.description as note_description, c.name as pm_name, NULL as completion_index FROM v2_programs p LEFT JOIN v2_knowledge_bank k ON CAST(p.note_id AS TEXT) = CAST(k.id AS TEXT) LEFT JOIN contacts c ON p.assigned_pm_id = c.cid WHERE p.id = ?`,
        args: [id],
      },
      {
        name: "participants_v2",
        sql: `SELECT CAST(id AS TEXT) as id, program_id, name, email, phone, screening_status, created_at, 'MANUAL' as group_name, 'manual' as source, v2_team_id FROM v2_participants WHERE program_id = ?`,
        args: [id],
      },
      {
        name: "participants_contacts",
        sql: `SELECT CAST(cid AS TEXT) as id, program_id, name, email, phone, 'approved' as screening_status, created_at, group_name, 'group' as source, v2_team_id FROM contacts WHERE program_id = ? OR UPPER(TRIM(group_name)) IN (SELECT UPPER(TRIM(name)) FROM families WHERE program_id = ?)`,
        args: [id, id],
      },
      {
        name: "teams",
        sql: "SELECT * FROM v2_teams WHERE program_id = ?",
        args: [id],
      },
      {
        name: "sessions",
        sql: "SELECT * FROM v2_sessions WHERE program_id = ?",
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
        sql: `SELECT ps.id, c.cid, c.name, c.email, ps.role FROM v2_program_staff ps JOIN contacts c ON ps.staff_id = c.cid WHERE ps.program_id = ?`,
        args: [id],
      },
      {
        name: "submissions",
        sql: "SELECT * FROM v2_submissions WHERE program_id = ?",
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
    ] = results;

    const program = progRes.rows[0];
    if (program) {
      try {
        program.materials =
          typeof program.materials === "string"
            ? JSON.parse(program.materials || "[]")
            : program.materials || [];

        // PARSE note_files (comes from k.url in DB as a JSON string like '[]')
        if (
          typeof program.note_files === "string" &&
          program.note_files.trim()
        ) {
          try {
            program.note_files = JSON.parse(program.note_files);
          } catch (e) {
            // Deep-unwrap: handle triple-encoded strings from double-serialization bugs
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
        // Normalize note_files entries: handle uppercase Name/URL keys from external imports
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

        // Fetch new Multi-PDF attachments for the linked Knowledge Note with explicit ID casting
        if (program.note_id) {
          const kbAttachmentsRes = await db.execute({
            sql: "SELECT name, url FROM v2_knowledge_attachments WHERE CAST(note_id AS TEXT) = CAST(? AS TEXT)",
            args: [program.note_id],
          });
          program.knowledge_assets = kbAttachmentsRes.rows;
        } else {
          program.knowledge_assets = [];
        }

        // --- DYNAMIC PROGRESS CALCULATION (OFFLOADED FROM SQL) ---
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

    // Capture "Assigned Team" from multiple sources
    let assignedStaff = assignedStaffRes.rows;

    // Check for "Legacy" or "Direct" assignments in program.assigned_assistant_id
    if (program?.assigned_assistant_id) {
      try {
        const assistantIds = JSON.parse(program.assigned_assistant_id);
        if (Array.isArray(assistantIds) && assistantIds.length > 0) {
          const assistantsRes = await db.execute({
            sql: `SELECT cid, name, email, phone, role FROM contacts WHERE cid IN (${assistantIds.map(() => "?").join(",")})`,
            args: assistantIds,
          });
          // Merge and remove duplicates by cid
          const merged = [...assignedStaff, ...assistantsRes.rows];
          assignedStaff = Array.from(
            new Map(merged.map((item) => [item.cid, item])).values(),
          );
        }
      } catch (e) {}
    }

    // --- PER-KPI PROGRESS CALCULATION ---
    const kpiList = kpiRes.rows || [];
    const sessionList = sesRes.rows || [];
    const docList = docRes.rows || [];
    const subList = subRes.rows || [];

    const kpisWithProgress = kpiList.map((kpi) => {
      const kpiId = String(kpi.id);
      // Find sessions linked to this KPI
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
      // Find document requirements linked to this KPI
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

      const completedSessions = linkedSessions.filter(
        (s) => s.status === "completed",
      ).length;
      const totalSessions = linkedSessions.length;
      const completedDocs = linkedDocs.filter((d) => d.is_completed).length;
      const totalDocs = linkedDocs.length;

      // Find submissions linked to this KPI via requirements
      const linkedSubmissions = subList.filter((sub) => {
        const reqId = String(sub.requirement_id || sub.document_id || "");
        return linkedDocs.some((d) => String(d.id) === reqId);
      });
      const completedSubmissions = linkedSubmissions.filter(
        (sub) => sub.status === "approved" || sub.status === "submitted",
      ).length;
      const totalSubmissions = linkedSubmissions.length;

      const totalItems = totalSessions + totalDocs + totalSubmissions;
      const completedItems =
        completedSessions + completedDocs + completedSubmissions;
      const progress =
        totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      return {
        ...kpi,
        progress,
        linkedSessions: totalSessions,
        completedSessions,
        linkedDocs: totalDocs,
        completedDocs,
        linkedSubmissions: totalSubmissions,
        completedSubmissions,
      };
    });

    // HARDENED DE-DUPLICATION: Merge sources and ensure participants are unique by email
    const allParticipantRows = [...parRes.rows, ...contRes.rows];
    const uniqueParticipants = Array.from(
      new Map(
        allParticipantRows
          .filter((p) => p.email)
          .map((p) => [p.email.toLowerCase(), p]),
      ).values(),
    );

    return NextResponse.json({
      success: true,
      program: program,
      participants: uniqueParticipants,
      teams: teamRes.rows,
      sessions: sesRes.rows,
      staffList: staffRes.rows,
      events: eventRes.rows,
      kpis: kpisWithProgress,
      documents: docRes.rows,
      followups: folRes.rows,
      assignedStaff: assignedStaff,
      submissions: subRes.rows,
      reports: repRes.rows,
      families: famRes.rows,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
