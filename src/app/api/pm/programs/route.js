import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { requireAuth, getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
export const dynamic = "force-dynamic";

/**
 * PROGRAMS API — OPERATIONAL INTELLIGENCE
 * Handles program lifecycle, completion metrics, and resource association.
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "admin",
      "program_manager",
      "teacher",
      "facilitator",
    ]);
    if (authError) return authError;
    const session = await getSession();
    const url = new URL(req.url);
    const assignedPmId = url.searchParams.get("assigned_pm_id");
    const showArchivedRaw = url.searchParams.get("show_archived");
    const status = url.searchParams.get("status");
    const showAll = showArchivedRaw === "all";
    const showArchived = showArchivedRaw === "true";
    const args = [];

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
    `;

    if (showAll) {
      // No archive filter — show everything
      baseQuery += " WHERE 1=1";
    } else {
      const archiveVal = showArchived ? 1 : 0;
      args.push(archiveVal, archiveVal);
      baseQuery +=
        " WHERE (p.is_archived = ? OR (p.is_archived IS NULL AND ? = 0))";
    }

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
    // Facilitators only see programs they are assigned to
    if (session?.role === "facilitator") {
      baseQuery +=
        " AND p.id IN (SELECT program_id FROM v2_program_staff WHERE staff_id = ? AND role = 'facilitator')";
      args.push(session.cid);
    }
    baseQuery += " ORDER BY p.created_at DESC";

    // Auto-activate programs where start_date has passed (gracefully fail if columns missing)
    try {
      await db.execute({
        sql: "UPDATE v2_programs SET status = 'Active' WHERE status = 'Planned' AND start_date IS NOT NULL AND start_date <= CURRENT_DATE",
        args: [],
      });
    } catch (_) {}

    const programsRes = await db.execute({ sql: baseQuery, args });
    const programs = programsRes.rows;

    if (programs.length === 0) {
      return NextResponse.json({ success: true, programs: [] });
    }

    // 2. Fetch Aggregate Metrics (Grouped)
    const [sessions, participants, docs, reports, segments, submissions] =
      await Promise.all([
        db.execute(
          "SELECT program_id, COUNT(*) as count, 0 as completed FROM v2_sessions GROUP BY program_id",
        ),
        db.execute(
          `SELECT program_id, COUNT(*) as count FROM (
             SELECT CAST(pp.program_id AS TEXT) AS program_id,
                    LOWER(COALESCE(c.email, pp.participant_id, '')) AS dedupe_key
             FROM participant_programs pp
             JOIN contacts c ON pp.participant_id = c.cid
             WHERE LOWER(COALESCE(c.status, '')) = 'active'
               AND c.deleted = 0 AND c.deleted_at IS NULL AND c.archived_at IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM v2_program_staff ps
                 WHERE CAST(ps.program_id AS TEXT) = CAST(pp.program_id AS TEXT)
                   AND ps.role = 'facilitator'
                   AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
               )
           ) t GROUP BY program_id`,
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
        db.execute(
          "SELECT program_id, COUNT(*) as total, COUNT(CASE WHEN status = 'approved' OR status = 'completed' THEN 1 END) as approved FROM v2_submissions GROUP BY program_id",
        ),
      ]);

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
      submissions: Object.fromEntries(
        submissions.rows.map((r) => [r.program_id, r]),
      ),
    };

    // 3. Assemble Final Data
    const enrichedPrograms = await Promise.all(
      programs.map(async (p) => {
      const s = metrics.sessions[p.id] || { count: 0, completed: 0 };
      const d = metrics.docs[p.id] || { count: 0, completed: 0 };
      const r_weeks = metrics.reports[p.id] || 0;
      const sub = metrics.submissions[p.id] || { total: 0, approved: 0 };

      // Calculate Completion Index in JS to offload DB
      const sessionsWeight = s.completed * 5.0;
      const docsWeight = d.completed * 2.0;
      const reportsWeight = r_weeks * 10.0;
      const submissionsWeight = sub.approved * 3.0;

      const duration = Number(p.duration_weeks) || 4;
      const totalPossibleWeight =
        s.count * 5.0 +
        d.count * 2.0 +
        duration * 10.0 +
        d.count * Number(p.participants_count || 1) * 3.0;
      const completion_index =
        totalPossibleWeight > 0
          ? ((sessionsWeight + docsWeight + reportsWeight + submissionsWeight) /
              totalPossibleWeight) *
            100
          : 0;

      // Program facilitators (external personnel, role='facilitator')
      let facilitators = [];
      try {
        const facRes = await db.execute({
          sql: `SELECT ps.id, ps.staff_id, ps.role, ps.permissions, c.name, c.email
                FROM v2_program_staff ps
                LEFT JOIN contacts c ON ps.staff_id = c.cid OR LOWER(TRIM(c.email)) = LOWER(TRIM(ps.staff_id))
                WHERE CAST(ps.program_id AS TEXT) = ? AND ps.role = 'facilitator'`,
          args: [String(p.id)],
        });
        facilitators = facRes.rows.map((r) => {
          let perms = r.permissions || {};
          if (typeof perms === "string") {
            try { perms = JSON.parse(perms); } catch { perms = {}; }
          }
          return {
            id: r.id,
            cid: r.staff_id,
            role: r.role || "facilitator",
            permissions: perms,
            name: r.name || r.email || r.staff_id,
            email: r.email || r.staff_id,
          };
        });
      } catch (_) {}

      // Parse facilitator default permissions defensively
      let fdp = p.facilitator_default_permissions || {};
      if (typeof fdp === "string") {
        try { fdp = JSON.parse(fdp); } catch { fdp = {}; }
      }

      return {
        ...p,
        sessions_count: s.count,
        participants_count: metrics.participants[p.id] || 0,
        docs_total: d.count,
        docs_completed: d.completed,
        reports_count: r_weeks,
        completion_index: Math.round(completion_index),
        assigned_segments: metrics.segments[p.id] || [],
        submissions_total: sub.total,
        submissions_approved: sub.approved,
        facilitators,
        facilitator_default_permissions: fdp,
        facilitator_scope: p.facilitator_scope || "assigned_groups",
      };
    }),
    );

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
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const {
      name,
      description,
      concept_note,
      vision,
      objectives,
      program_type,
      visibility,
      participant_limit,
      registration_window,
      language,
      note_id,
      assigned_pm_id,
      assigned_assistant_id,
      duration_weeks,
      materials,
      start_date,
      end_date,
      assigned_segments,
      kpis,
      expected_outcomes,
      success_metrics,
      banner_url,
    } = await req.json();
    const id = uuidv4();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 100) + '-' + id.substring(0, 8);

    // Ensure new columns exist
    try { await db.execute({ sql: "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS slug TEXT", args: [] }); } catch(_) {}
    try { await db.execute({ sql: "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS expected_outcomes TEXT", args: [] }); } catch(_) {}
    try { await db.execute({ sql: "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS success_metrics TEXT", args: [] }); } catch(_) {}
    try { await db.execute({ sql: "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS banner_url TEXT", args: [] }); } catch(_) {}

    // B6: Check duplicate program name
    const existing = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE LOWER(name) = LOWER(?) AND is_archived = 0",
      args: [name],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: "A program with this name already exists." },
        { status: 409 },
      );
    }

    await db.execute({
      sql: `INSERT INTO v2_programs (id, name, slug, description, concept_note, vision, objectives, expected_outcomes, success_metrics, banner_url, program_type, visibility, participant_limit, registration_window, language, note_id, assigned_pm_id, assigned_assistant_id, duration_weeks, status, is_archived, materials, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        name,
        slug,
        description || null,
        concept_note || null,
        vision || null,
        objectives || null,
        expected_outcomes || null,
        success_metrics || null,
        banner_url || null,
        program_type || "incubation",
        visibility || "private",
        participant_limit || 0,
        registration_window || null,
        language || "en",
        note_id || null,
        assigned_pm_id || null,
        assigned_assistant_id || null,
        parseInt(duration_weeks) || 4,
        "Planned",
        0,
        materials ? JSON.stringify(materials) : null,
        start_date || null,
        end_date || null,
      ],
    });

      // Auto-create the system-defined Facilitators group for this program
      try {
        await db.execute({
          sql: `INSERT INTO v2_groups (program_id, name, type, is_system)
                SELECT ?, 'Facilitators', 'facilitators', 1
                WHERE NOT EXISTS (
                  SELECT 1 FROM v2_groups WHERE program_id = ? AND UPPER(TRIM(name)) = 'FACILITATORS'
                )`,
          args: [programId, programId],
        });
      } catch (_) {}
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

    // Handle KPIs — auto-populate defaults if none provided
    const DEFAULT_KPIS = [
      { title: "Attendance Rate", target_value: 80 },
      { title: "Assignment Completion", target_value: 80 },
      { title: "Session Participation", target_value: 80 },
      { title: "Team Engagement", target_value: 80 },
      { title: "Coaching Completion", target_value: 80 },
      { title: "Graduation Rate", target_value: 80 },
    ];
    const kpisToCreate = (Array.isArray(kpis) && kpis.length > 0) ? kpis : DEFAULT_KPIS;
    for (const kpi of kpisToCreate) {
      if (!kpi.title) continue;
      await db.execute({
        sql: "INSERT INTO v2_kpis (program_id, title, target_value) VALUES (?, ?, ?)",
        args: [id, kpi.title, kpi.target_value || 80],
      });
    }

    // B10: Audit log
    const session = await getSession();
    await logAuditEvent({
      entity_type: "program",
      entity_id: id,
      user_id: session?.user_cid || "system",
      user_name: session?.name || "System",
      action: "created",
      details: `Program "${name}" created`,
    });

    // B11: Notification PM assignment
    if (assigned_pm_id) {
      await logAuditEvent({
        entity_type: "program_assignment",
        entity_id: id,
        user_id: assigned_pm_id,
        user_name: name,
        action: "assigned",
        details: `You have been assigned as Program Manager for "${name}"`,
      });
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
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "admin",
    ]);
    if (authError) return authError;
    const {
      id,
      name,
      description,
      concept_note,
      vision,
      objectives,
      expected_outcomes,
      success_metrics,
      banner_url,
      program_type,
      visibility,
      participant_limit,
      registration_window,
      language,
      note_id,
      assigned_pm_id,
      assigned_assistant_id,
      duration_weeks,
      status,
      materials,
      assigned_segments,
      start_date,
      end_date,
      grading_mode,
      is_archived,
      facilitator_default_permissions,
      facilitator_scope,
    } = await req.json();

    if (!id)
      return NextResponse.json(
        { success: false, error: "ID required" },
        { status: 400 },
      );

    // Verify the program exists before updating or assigning
    const progExists = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE id = ?",
      args: [id],
    });
    if (progExists.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Program "${id}" not found.` },
        { status: 404 },
      );
    }

    // Name required for non-archive updates
    if (!name && is_archived === undefined) {
      return NextResponse.json(
        { success: false, error: "Name required" },
        { status: 400 },
      );
    }

    // If is_archived is provided without a name, it's a quick archive action
    if (is_archived !== undefined && !name) {
      const newStatus = is_archived ? "archived" : "active";
      await db.execute({
        sql: "UPDATE v2_programs SET is_archived = ?, status = ? WHERE id = ?",
        args: [is_archived, newStatus, id],
      });
      return NextResponse.json({ success: true });
    }

    // Sync status: if setting to archived, also mark is_archived
    const finalIsArchived = status === "archived" ? 1 : 0;

    await db.execute({
      sql: `UPDATE v2_programs
                SET name = ?, description = ?, concept_note = ?, vision = ?, objectives = ?, expected_outcomes = ?, success_metrics = ?, banner_url = ?, program_type = ?, visibility = ?, participant_limit = ?, registration_window = ?, language = ?, note_id = ?, assigned_pm_id = ?, assigned_assistant_id = ?, duration_weeks = ?, status = ?, is_archived = ?, materials = ?, start_date = ?, end_date = ?, grading_mode = ?, facilitator_default_permissions = ?, facilitator_scope = ?
                WHERE id = ?`,
      args: [
        name,
        description,
        concept_note || null,
        vision || null,
        objectives || null,
        expected_outcomes || null,
        success_metrics || null,
        banner_url || null,
        program_type || "incubation",
        visibility || "private",
        participant_limit || 0,
        registration_window || null,
        language || "en",
        note_id || null,
        assigned_pm_id || null,
        assigned_assistant_id || null,
        duration_weeks || 4,
        status,
        finalIsArchived,
        JSON.stringify(typeof materials === "string" ? JSON.parse(materials || "[]") : (materials || [])),
        start_date || null,
        end_date || null,
        grading_mode || "graded",
        JSON.stringify(facilitator_default_permissions || {}),
        facilitator_scope || "assigned_groups",
        id,
      ],
    });

    // B10: Audit log
    const session = await getSession();
    await logAuditEvent({
      entity_type: "program",
      entity_id: id,
      user_id: session?.user_cid || "system",
      user_name: session?.name || "System",
      action: "updated",
      details: `Program "${name}" updated`,
    });

    // B11: Notification PM assignment change
    if (assigned_pm_id) {
      await logAuditEvent({
        entity_type: "program_assignment",
        entity_id: id,
        user_id: assigned_pm_id,
        user_name: name,
        action: "assigned",
        details: `You have been assigned as Program Manager for "${name}"`,
      });
    }

    // Handle Segment/Team Assignments
    if (Array.isArray(assigned_segments)) {
      // 1. Unlink segments currently assigned to this program
      // Guard: skip if program_id column has legacy non-UUID values
      try {
        await db.execute({
          sql: "UPDATE families SET program_id = NULL WHERE program_id IS NOT NULL AND program_id::text = ?",
          args: [String(id)],
        });
      } catch (e) { console.warn("[programs] Could not unlink families segments:", e.message); }

      // 2. Link the new set of segments
      if (assigned_segments.length > 0) {
        for (const segmentId of assigned_segments) {
          if (!segmentId) continue;
          const sid = !isNaN(segmentId) ? Number(segmentId) : null;
          let familyName = "";

          if (sid !== null) {
            try {
              await db.execute({
                sql: "UPDATE families SET program_id = ?::uuid WHERE id = ?",
                args: [String(id), sid],
              });
            } catch (e) { console.warn("[programs] Could not link family by id:", e.message); }
            const fRes = await db.execute({
              sql: "SELECT name FROM families WHERE id = ?",
              args: [sid],
            });
            if (fRes.rows && fRes.rows.length > 0) {
              familyName = fRes.rows[0].name;
            }
          } else {
            try {
              await db.execute({
                sql: "UPDATE families SET program_id = ?::uuid WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
                args: [String(id), segmentId],
              });
            } catch (e) { console.warn("[programs] Could not link family by name:", e.message); }
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
              sql: "SELECT cid, name, email, phone FROM contacts WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))",
              args: [familyName],
            });

            if (contactsRes.rows && contactsRes.rows.length > 0) {
              for (const contact of contactsRes.rows) {
                const {
                  cid: cCid,
                  name: cName,
                  email: cEmail,
                  phone: cPhone,
                } = contact;
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

                // Sync participant_programs junction table
                if (cCid) {
                  try {
                    await db.execute({
                      sql: `INSERT INTO participant_programs (participant_id, program_id)
                            VALUES (?, ?)
                            ON CONFLICT (participant_id, program_id) DO NOTHING`,
                      args: [cCid, id],
                    });
                  } catch (_) {
                    // participant_programs table may not exist
                  }
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
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
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
