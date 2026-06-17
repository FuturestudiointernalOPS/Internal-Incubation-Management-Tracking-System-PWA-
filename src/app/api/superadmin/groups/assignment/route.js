import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const { group_name, program_id, program_name } = await req.json();

    if (!group_name || !program_id) {
      return NextResponse.json(
        { success: false, error: "Group name and Program ID required" },
        { status: 400 },
      );
    }

    // Verify the program exists in v2_programs before assigning
    const progCheck = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE id = ?",
      args: [program_id],
    });
    if (progCheck.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Program "${program_id}" not found. Create the program first before assigning.`,
        },
        { status: 404 },
      );
    }

    // Update all contacts in the group with the program_id
    await db.execute({
      sql: "UPDATE contacts SET program_id = ?, program_name = ? WHERE group_name = ?",
      args: [program_id, program_name || null, group_name],
    });

    // Also update v2_participants if they exist for these contacts
    // (Assuming participants are linked to contacts by email or name)
    const contactsRes = await db.execute({
      sql: "SELECT cid, email, name, phone FROM contacts WHERE group_name = ?",
      args: [group_name],
    });

    for (const contact of contactsRes.rows) {
      await db
        .execute({
          sql: `INSERT INTO v2_participants (program_id, name, email, phone, status)
              VALUES (?, ?, ?, ?, 'Active')
              ON CONFLICT(email, program_id) DO UPDATE SET status = 'Active'`,
          args: [program_id, contact.name, contact.email, contact.phone],
        })
        .catch(() => {
          // Fallback if unique constraint (email, program_id) is not there
          db.execute({
            sql: "UPDATE v2_participants SET status = 'Active' WHERE email = ? AND program_id = ?",
            args: [contact.email, program_id],
          });
        });

      // Sync participant_programs junction table
      if (contact.cid) {
        try {
          await db.execute({
            sql: `INSERT INTO participant_programs (participant_id, program_id, assigned_by, source)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT (participant_id, program_id) DO NOTHING`,
            args: [contact.cid, program_id, "system", "group_assignment"],
          });
        } catch (_) {
          // participant_programs table may not exist
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Assigned ${contactsRes.rows.length} contacts to program.`,
    });
  } catch (error) {
    console.error("Group Assignment Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
