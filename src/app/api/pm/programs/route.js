import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
export const dynamic = "force-dynamic";

/**
 * PROGRAMS API — OPERATIONAL INTELLIGENCE
 * Handles program lifecycle, completion metrics, and resource association.
 */

export async function GET(req) {
  try {
    await initDb();
    const url = new URL(req.url);
    const assignedPmId = url.searchParams.get("assigned_pm_id");
    const showArchived = url.searchParams.get("show_archived") === "true";
    const status = url.searchParams.get("status");
    const archiveVal = showArchived ? 1 : 0;
    const args = [archiveVal, archiveVal];

    // 1. Fetch Basic Programs
    let baseQuery = `
      SELECT p.*,
             c1.name as pm_name,
             c2.name as assistant_name,
             k.title as note_title
      FROM v2_programs p
      LEFT JOIN contacts c1 ON p.assigned_pm_id = c1.cid
      LEFT JOIN contacts c2 ON p.assigned_assistant_id = c2.cid
      LEFT JOIN v2_knowledge_bank k ON CAST(p.note_id AS TEXT) = CAST(k.id AS TEXT)
      WHERE (p.is_archived = ? OR (p.is_archived IS NULL AND ? = 0))
    `;

    if (status && status.toLowerCase() !== "all") {
      if (status.toLowerCase() === "active") {
        baseQuery += " AND (p.status ILIKE ? OR p.status IS NULL)";
      } else {
        baseQuery += " AND p.status ILIKE ?";
      }
      args.push(status);
    }
    if (assignedPmId) {
      baseQuery +=
        " AND (p.assigned_pm_id = ? OR p.assigned_assistant_id LIKE ? OR p.id IN (SELECT program_id FROM v2_teams WHERE handler_id = ?))";
      args.push(assignedPmId, `%${assignedPmId}%`, assignedPmId);
    }
    baseQuery += " ORDER BY p.created_at DESC";

    const programsRes = await db.execute({ sql: baseQuery, args });
    const programs = programsRes.rows;

    if (programs.length === 0) {
      return NextResponse.json({ success: true, programs: [] });
    }

    // 2. Fetch Aggregate Metrics (Grouped)
    const [sessions, participants, docs, reports, segments] = await Promise.all(
      [
        db.execute(
          "SELECT program_id, COUNT(*) as count, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed FROM v2_sessions GROUP BY program_id",
        ),
        db.execute(
          "SELECT program_id, COUNT(*) as count FROM v2_participants GROUP BY program_id",
        ),
        db.execute(
          "SELECT program_id, COUNT(*) as count, SUM(is_completed) as completed FROM v2_document_requirements GROUP BY program_id",
        ),
        db.execute(
          "SELECT program_id, COUNT(DISTINCT week_number) as weeks FROM v2_weekly_reports GROUP BY program_id",
        ),
        db.execute(
          "SELECT id, program_id FROM families WHERE program_id IS NOT NULL",
        ),
      ],
    );

    // Map metrics for O(1) lookup
    const metrics = {
      sessions: Object.fromEntries(sessions.rows.map((r) => [r.program_id, r])),
      participants: Object.fromEntries(
        participants.rows.map((r) => [r.program_id, r.count]),
      ),
      docs: Object.fromEntries(docs.rows.map((r) => [r.program_id, r])),
      reports: Object.fromEntries(
        reports.rows.map((r) => [r.program_id, r.weeks]),
      ),
      segments: segments.rows.reduce((acc, r) => {
        if (!acc[r.program_id]) acc[r.program_id] = [];
        acc[r.program_id].push(r.id);
        return acc;
      }, {}),
    };

    // 3. Assemble Final Data
    const enrichedPrograms = programs.map((p) => {
      const s = metrics.sessions[p.id] || { count: 0, completed: 0 };
      const d = metrics.docs[p.id] || { count: 0, completed: 0 };
      const r_weeks = metrics.reports[p.id] || 0;

      // Calculate Completion Index in JS to offload DB
      const sessionsWeight = s.completed * 5.0;
      const docsWeight = d.completed * 2.0;
      const reportsWeight = r_weeks * 10.0;

      const duration = Number(p.duration_weeks) || 4;
      const totalPossibleWeight =
        s.count * 5.0 + d.count * 2.0 + duration * 10.0;
      const completion_index =
        totalPossibleWeight > 0
          ? ((sessionsWeight + docsWeight + reportsWeight) /
              totalPossibleWeight) *
            100
          : 0;

      return {
        ...p,
        sessions_count: s.count,
        participants_count: metrics.participants[p.id] || 0,
        docs_total: d.count,
        docs_completed: d.completed,
        reports_count: r_weeks,
        completion_index: Math.round(completion_index),
        assigned_segments: metrics.segments[p.id] || [],
      };
    });

    return NextResponse.json({ success: true, programs: enrichedPrograms });
  } catch (error) {
    console.error("GET Programs Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const {
      name,
      description,
      note_id,
      assigned_pm_id,
      assigned_assistant_id,
      duration_weeks,
      materials,
      start_date,
      end_date,
      assigned_segments,
      kpis,
    } = await req.json();
    const id =
      "P-" +
      new Date().getFullYear() +
      "-" +
      uuidv4().split("-")[0].toUpperCase();

    await db.execute({
      sql: `INSERT INTO v2_programs (id, name, description, note_id, assigned_pm_id, assigned_assistant_id, duration_weeks, status, is_archived, materials, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        name,
        description,
        note_id || null,
        assigned_pm_id || null,
        assigned_assistant_id || null,
        duration_weeks || 4,
        "active",
        0,
        JSON.stringify(materials || []),
        start_date || null,
        end_date || null,
      ],
    });

    // Handle Segment/Team Assignments for new program
    if (Array.isArray(assigned_segments) && assigned_segments.length > 0) {
      for (const segmentId of assigned_segments) {
        if (!segmentId) continue;
        const sid = !isNaN(segmentId) ? Number(segmentId) : null;
        if (sid !== null) {
          await db.execute({
            sql: "UPDATE families SET program_id = ? WHERE id = ?",
            args: [id, sid],
          });
        } else {
          await db.execute({
            sql: "UPDATE families SET program_id = ? WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
            args: [id, segmentId],
          });
        }
      }
    }

    // Handle KPIs
    if (Array.isArray(kpis) && kpis.length > 0) {
      for (const kpi of kpis) {
        if (!kpi.title) continue;
        await db.execute({
          sql: "INSERT INTO v2_kpis (program_id, title, target_value) VALUES (?, ?, ?)",
          args: [id, kpi.title, kpi.target_value || 80],
        });
      }
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("POST Program Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const {
      id,
      name,
      description,
      note_id,
      assigned_pm_id,
      assigned_assistant_id,
      duration_weeks,
      status,
      materials,
      assigned_segments,
      start_date,
      end_date,
    } = await req.json();

    if (!id)
      return NextResponse.json(
        { success: false, error: "ID required" },
        { status: 400 },
      );

    await db.execute({
      sql: `UPDATE v2_programs
                SET name = ?, description = ?, note_id = ?, assigned_pm_id = ?, assigned_assistant_id = ?, duration_weeks = ?, status = ?, materials = ?, start_date = ?, end_date = ?
                WHERE id = ?`,
      args: [
        name,
        description,
        note_id || null,
        assigned_pm_id || null,
        assigned_assistant_id || null,
        duration_weeks || 4,
        status,
        JSON.stringify(materials || []),
        start_date || null,
        end_date || null,
        id,
      ],
    });

    // Handle Segment/Team Assignments
    if (Array.isArray(assigned_segments)) {
      // 1. Unlink segments currently assigned to this program
      await db.execute({
        sql: "UPDATE families SET program_id = NULL WHERE program_id = ?",
        args: [id],
      });

      // 2. Link the new set of segments
      if (assigned_segments.length > 0) {
        for (const segmentId of assigned_segments) {
          if (!segmentId) continue;
          const sid = !isNaN(segmentId) ? Number(segmentId) : null;
          let familyName = "";

          if (sid !== null) {
            await db.execute({
              sql: "UPDATE families SET program_id = ? WHERE id = ?",
              args: [id, sid],
            });
            const fRes = await db.execute({
              sql: "SELECT name FROM families WHERE id = ?",
              args: [sid],
            });
            if (fRes.rows && fRes.rows.length > 0) {
              familyName = fRes.rows[0].name;
            }
          } else {
            await db.execute({
              sql: "UPDATE families SET program_id = ? WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
              args: [id, segmentId],
            });
            familyName = segmentId;
          }

          // 3. Update contacts and v2_participants with the new program assignment
          if (familyName) {
            // Update contacts
            await db.execute({
              sql: "UPDATE contacts SET program_id = ?, program_name = ? WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))",
              args: [id, name, familyName],
            });

            // Upsert v2_participants using SELECT then INSERT/UPDATE pattern
            const contactsRes = await db.execute({
              sql: "SELECT name, email, phone FROM contacts WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))",
              args: [familyName],
            });

            if (contactsRes.rows && contactsRes.rows.length > 0) {
              for (const contact of contactsRes.rows) {
                const { name: cName, email: cEmail, phone: cPhone } = contact;
                if (!cEmail) continue;

                const existRes = await db.execute({
                  sql: "SELECT id FROM v2_participants WHERE email = ? AND program_id = ?",
                  args: [cEmail, id],
                });

                if (existRes.rows && existRes.rows.length > 0) {
                  await db.execute({
                    sql: "UPDATE v2_participants SET name = ?, phone = ? WHERE id = ?",
                    args: [cName, cPhone, existRes.rows[0].id],
                  });
                } else {
                  await db.execute({
                    sql: "INSERT INTO v2_participants (program_id, name, email, phone, screening_status, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
                    args: [id, cName, cEmail, cPhone, "pending"],
                  });
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT Program Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const { id } = await req.json();

    if (!id)
      return NextResponse.json(
        { success: false, error: "ID required" },
        { status: 400 },
      );

    await db.execute({
      sql: "DELETE FROM v2_programs WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
