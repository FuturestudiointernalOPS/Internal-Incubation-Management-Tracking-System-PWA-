import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const { group_name, program_id, program_name } = await req.json();

    if (!group_name || !program_id) {
      return NextResponse.json({ success: false, error: "Group name and Program ID required" }, { status: 400 });
    }

    // Update all contacts in the group with the program_id
    await db.execute({
      sql: "UPDATE contacts SET program_id = ?, program_name = ? WHERE group_name = ?",
      args: [program_id, program_name || null, group_name]
    });

    // Also update v2_participants if they exist for these contacts
    // (Assuming participants are linked to contacts by email or name)
    const contactsRes = await db.execute({
      sql: "SELECT email, name, phone FROM contacts WHERE group_name = ?",
      args: [group_name]
    });

    for (const contact of contactsRes.rows) {
      await db.execute({
        sql: `INSERT INTO v2_participants (program_id, name, email, phone, status) 
              VALUES (?, ?, ?, ?, 'Active')
              ON CONFLICT(email, program_id) DO UPDATE SET status = 'Active'`,
        args: [program_id, contact.name, contact.email, contact.phone]
      }).catch(() => {
        // Fallback if unique constraint (email, program_id) is not there
        db.execute({
          sql: "UPDATE v2_participants SET status = 'Active' WHERE email = ? AND program_id = ?",
          args: [contact.email, program_id]
        });
      });
    }

    return NextResponse.json({ success: true, message: `Assigned ${contactsRes.rows.length} contacts to program.` });
  } catch (error) {
    console.error("Group Assignment Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
