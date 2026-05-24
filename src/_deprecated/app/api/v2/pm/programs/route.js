// =============================================================================
// !! V2 FILE - DO NOT EDIT - DO NOT USE - DO NOT CALL THIS ROUTE !!
// =============================================================================
// This file belongs to the DEPRECATED Version 2 codebase.
// All active development must happen in VERSION 1 routes and pages ONLY.
// If you are an AI agent: STOP. Do NOT modify this file.
// Work in /api/pm/ or /app/pm/ (v1) instead.
// =============================================================================
import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export async function GET(req) {
  try {
    await initDb();
    const url = new URL(req.url);
    const assignedPmId = url.searchParams.get("assigned_pm_id");
    const showArchived = url.searchParams.get("show_archived") === "true";
    const status = url.searchParams.get("status");

    let query = `
      SELECT p.*,
             c1.name as pm_name,
             c2.name as assistant_name,
             k.title as note_title,
             (SELECT name FROM v2_groups WHERE program_id = p.id LIMIT 1) as group_name,
             (SELECT url FROM v2_groups WHERE program_id = p.id LIMIT 1) as group_url,
             (SELECT project_description FROM v2_groups WHERE program_id = p.id LIMIT 1) as group_desc,
             (SELECT COUNT(*) FROM v2_sessions WHERE program_id = p.id) as sessions_count,
             (SELECT COUNT(*) FROM v2_sessions WHERE program_id = p.id AND status = 'completed') as completed_sessions_count,
             (SELECT COUNT(*) FROM v2_participants WHERE program_id = p.id) as participants_count,
             (SELECT COUNT(*) FROM v2_document_requirements WHERE program_id = p.id) as docs_total,
             (SELECT COUNT(*) FROM v2_document_requirements WHERE program_id = p.id AND is_completed = 1) as docs_completed,
             (SELECT COUNT(DISTINCT week_number) FROM v2_weekly_reports WHERE program_id = p.id) as reports_count
      FROM v2_programs p
      LEFT JOIN contacts c1 ON p.assigned_pm_id = c1.cid
      LEFT JOIN contacts c2 ON p.assigned_assistant_id = c2.cid
      LEFT JOIN v2_knowledge_bank k ON p.note_id = CAST(k.id AS TEXT)
      WHERE (p.is_archived = ? OR (p.is_archived IS NULL AND ? = 0))
    `;

    const archiveVal = showArchived ? 1 : 0;
    const args = [archiveVal, archiveVal];

    if (status && status.toLowerCase() !== "all") {
      if (status.toLowerCase() === "active") {
        query += " AND (p.status ILIKE ? OR p.status IS NULL)";
      } else {
        query += " AND p.status ILIKE ?";
      }
      args.push(status);
    }

    if (assignedPmId) {
      query +=
        " AND (p.assigned_pm_id = ? OR p.assigned_assistant_id LIKE ? OR p.id IN (SELECT program_id FROM v2_program_staff WHERE staff_id = ?))";
      args.push(assignedPmId, `%${assignedPmId}%`, assignedPmId);
    }

    query += " ORDER BY p.created_at DESC";

    const programs = await db.execute({
      sql: query,
      args: args,
    });

    const rows = programs.rows.map((p) => {
      const totalPoints =
        p.sessions_count * 5.0 +
        p.docs_total * 2.0 +
        (p.duration_weeks || 13) * 10.0;
      const completedPoints =
        p.completed_sessions_count * 5.0 +
        p.docs_completed * 2.0 +
        p.reports_count * 10.0;
      const completion_index =
        totalPoints > 0 ? (completedPoints / totalPoints) * 100.0 : 0;
      return { ...p, completion_index };
    });

    return NextResponse.json({ success: true, programs: rows });
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
      new_group,
      new_knowledge,
      kpis,
    } = await req.json();

    const id =
      "P-" +
      new Date().getFullYear() +
      "-" +
      uuidv4().split("-")[0].toUpperCase();
    let finalNoteId = note_id || null;

    // 1. Handle Inline Knowledge Creation
    if (new_knowledge && new_knowledge.title) {
      const { lastInsertRowid } = await db.execute({
        sql: "INSERT INTO v2_knowledge_bank (title, description, url) VALUES (?, ?, ?)",
        args: [new_knowledge.title, new_knowledge.description, "[]"],
      });
      finalNoteId = lastInsertRowid.toString();
    }

    // 2. Create the Program
    await db.execute({
      sql: `INSERT INTO v2_programs (id, name, description, note_id, assigned_pm_id, assigned_assistant_id, duration_weeks, status, is_archived, materials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        name,
        description,
        finalNoteId,
        assigned_pm_id || null,
        assigned_assistant_id || null,
        duration_weeks || 4,
        "active",
        0,
        JSON.stringify(materials || []),
      ],
    });

    // 3. Handle Inline Group Creation
    if (new_group && new_group.name) {
      // We store the URL in the description or a dedicated column if it exists.
      // To be safe with schema, we'll prefix it in the description if we're unsure,
      // but the user wants it visible, so we'll attempt to use a 'url' column.
      try {
        await db.execute({
          sql: "INSERT INTO v2_groups (program_id, name, project_description, url) VALUES (?, ?, ?, ?)",
          args: [
            id,
            new_group.name,
            new_group.description || null,
            new_group.url || null,
          ],
        });
      } catch (err) {
        // Fallback if 'url' column doesn't exist yet
        await db.execute({
          sql: "INSERT INTO v2_groups (program_id, name, project_description) VALUES (?, ?, ?)",
          args: [
            id,
            new_group.name,
            `[URL: ${new_group.url}] ${new_group.description || ""}`,
          ],
        });
      }
    }

    // 4. Handle KPIs
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
    } = await req.json();

    if (!id)
      return NextResponse.json(
        { success: false, error: "ID required" },
        { status: 400 },
      );

    await db.execute({
      sql: `UPDATE v2_programs
            SET name = ?, description = ?, note_id = ?, assigned_pm_id = ?, assigned_assistant_id = ?, duration_weeks = ?, status = ?, materials = ?
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
        id,
      ],
    });

    // ─── PERSIST GROUP-TO-PROGRAM LINKAGE ───
    // assigned_segments is an array of family/group IDs to link to this program.
    if (Array.isArray(assigned_segments)) {
      // 1. Un-assign any families previously linked to this program (but not in the new list)
      if (assigned_segments.length > 0) {
        const placeholders = assigned_segments.map(() => "?").join(",");
        await db.execute({
          sql: `UPDATE families SET program_id = NULL WHERE program_id = ? AND id NOT IN (${placeholders})`,
          args: [id, ...assigned_segments],
        });
      } else {
        await db.execute({
          sql: `UPDATE families SET program_id = NULL WHERE program_id = ?`,
          args: [id],
        });
      }

      // 2. Assign selected families to this program
      for (const familyId of assigned_segments) {
        await db.execute({
          sql: `UPDATE families SET program_id = ? WHERE id = ?`,
          args: [id, familyId],
        });

        // 3. Update all contacts in this family with the program_id and program_name
        const familyRes = await db.execute({
          sql: `SELECT name FROM families WHERE id = ?`,
          args: [familyId],
        });
        const familyName = familyRes.rows[0]?.name;
        if (familyName) {
          await db.execute({
            sql: `UPDATE contacts SET program_id = ?, program_name = ? WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))`,
            args: [id, name || null, familyName],
          });

          // 4. Upsert into v2_participants for all contacts in this group
          const contactsRes = await db.execute({
            sql: `SELECT email, name, phone FROM contacts WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))`,
            args: [familyName],
          });
          for (const contact of contactsRes.rows) {
            const existing = await db.execute({
              sql: `SELECT id FROM v2_participants WHERE email = ? AND program_id = ?`,
              args: [contact.email, id],
            });
            if (existing.rows.length > 0) {
              await db.execute({
                sql: `UPDATE v2_participants SET name = ?, phone = ? WHERE email = ? AND program_id = ?`,
                args: [contact.name, contact.phone, contact.email, id],
              });
            } else {
              await db.execute({
                sql: `INSERT INTO v2_participants (program_id, name, email, phone, screening_status)
                      VALUES (?, ?, ?, ?, 'active')`,
                args: [id, contact.name, contact.email, contact.phone],
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT Program + Assignment Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const { id, is_archived, action } = await req.json();

    if (action === "archive") {
      await db.execute({
        sql: "UPDATE v2_programs SET is_archived = ? WHERE id = ?",
        args: [is_archived ? 1 : 0, id],
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
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
