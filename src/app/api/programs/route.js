import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "@/lib/auth";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const body = await req.json();
    const {
      name,
      description,
      duration_weeks,
      duration_days,
      topics,
      outcomes,
      deliverables,
      resources,
      assigned_pm_id,
      feedback_enabled,
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Program name is required" },
        { status: 400 },
      );
    }

    const programId = `P-2026-${uuidv4().slice(0, 8).toUpperCase()}`;

    const { lastInsertRowid } = await db.execute({
      sql: `INSERT INTO v2_programs (
        id, name, description, duration_weeks, duration_days,
        topics, outcomes, deliverables, resources, assigned_pm_id, feedback_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        programId,
        name,
        description,
        duration_weeks || 13,
        duration_days || 0,
        JSON.stringify(topics || []),
        JSON.stringify(outcomes || []),
        JSON.stringify(deliverables || []),
        JSON.stringify(resources || []),
        assigned_pm_id || null,
        feedback_enabled !== undefined ? (feedback_enabled ? 1 : 0) : 1,
      ],
    });

    return NextResponse.json({
      success: true,
      program: { id: programId, name, description },
    });
  } catch (error) {
    console.error("V2 Program Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const { rows } = await db.execute(
      "SELECT * FROM v2_programs ORDER BY created_at DESC",
    );

    // Parse JSON columns
    const programs = rows.map((r) => ({
      ...r,
      topics: r.topics ? JSON.parse(r.topics) : [],
      outcomes: r.outcomes ? JSON.parse(r.outcomes) : [],
      deliverables: r.deliverables ? JSON.parse(r.deliverables) : [],
      resources: r.resources ? JSON.parse(r.resources) : [],
      feedback_enabled: !!r.feedback_enabled,
    }));

    return NextResponse.json({ success: true, programs });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const data = await req.json();

    if (!data.id) {
      return NextResponse.json(
        { success: false, error: "Program ID is required for update." },
        { status: 400 },
      );
    }

    // Verify the program exists before updating or assigning
    const progExists = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE id = ?",
      args: [data.id],
    });
    if (progExists.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Program "${data.id}" not found.` },
        { status: 404 },
      );
    }

    const fieldsToUpdate = [];
    const args = [];

    // Whitelist updatable fields
    const updatableColumns = [
      "name",
      "description",
      "duration_weeks",
      "duration_days",
      "topics",
      "outcomes",
      "deliverables",
      "resources",
      "assigned_pm_id",
      "manager_name",
      "document_title",
      "document_id",
      "feedback_enabled",
      "status",
    ];

    for (const col of updatableColumns) {
      if (data[col] !== undefined) {
        fieldsToUpdate.push(`${col} = ?`);

        if (["topics", "outcomes", "deliverables", "resources"].includes(col)) {
          args.push(JSON.stringify(data[col] || []));
        } else if (col === "feedback_enabled") {
          args.push(data[col] ? 1 : 0);
        } else {
          args.push(data[col]);
        }
      }
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No fields to update.",
      });
    }

    // Add ID for the WHERE clause
    args.push(data.id);

    await db.execute({
      sql: `UPDATE v2_programs SET ${fieldsToUpdate.join(", ")} WHERE id = ?`,
      args: args,
    });

    // ─── PERSIST GROUP-TO-PROGRAM LINKAGE ───
    // assigned_segments is an array of family/group IDs to link to this program.
    if (Array.isArray(data.assigned_segments)) {
      const programId = data.id;
      const programName = data.name;

      // 1. Un-assign families no longer in the list
      if (data.assigned_segments.length > 0) {
        const placeholders = data.assigned_segments.map(() => "?").join(",");
        await db.execute({
          sql: `UPDATE families SET program_id = NULL WHERE program_id = ? AND id NOT IN (${placeholders})`,
          args: [programId, ...data.assigned_segments],
        });
      } else {
        await db.execute({
          sql: `UPDATE families SET program_id = NULL WHERE program_id = ?`,
          args: [programId],
        });
      }

      // 2. Assign selected families
      for (const familyId of data.assigned_segments) {
        await db.execute({
          sql: `UPDATE families SET program_id = ? WHERE id = ?`,
          args: [programId, familyId],
        });

        // 3. Update contacts in this family
        const familyRes = await db.execute({
          sql: `SELECT name FROM families WHERE id = ?`,
          args: [familyId],
        });
        const familyName = familyRes.rows[0]?.name;
        if (familyName) {
          await db.execute({
            sql: `UPDATE contacts SET program_id = ?, program_name = ? WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))`,
            args: [programId, programName || null, familyName],
          });

          // 4. Upsert into v2_participants
          const contactsRes = await db.execute({
            sql: `SELECT cid, email, name, phone FROM contacts WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))`,
            args: [familyName],
          });
          for (const contact of contactsRes.rows) {
            const existing = await db.execute({
              sql: `SELECT id FROM v2_participants WHERE email = ? AND program_id = ?`,
              args: [contact.email, programId],
            });
            if (existing.rows.length > 0) {
              await db.execute({
                sql: `UPDATE v2_participants SET name = ?, phone = ? WHERE email = ? AND program_id = ?`,
                args: [contact.name, contact.phone, contact.email, programId],
              });
            } else {
              await db.execute({
                sql: `INSERT INTO v2_participants (program_id, name, email, phone, screening_status)
                      VALUES (?, ?, ?, ?, 'active')`,
                args: [programId, contact.name, contact.email, contact.phone],
              });
            }

            // 5. Sync participant_programs junction table
            if (contact.cid) {
              try {
                await db.execute({
                  sql: `INSERT INTO participant_programs (participant_id, program_id, assigned_by, source)
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT (participant_id, program_id) DO NOTHING`,
                  args: [contact.cid, programId, "system", "program_update"],
                });
              } catch (_) {
                // participant_programs table may not exist
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
