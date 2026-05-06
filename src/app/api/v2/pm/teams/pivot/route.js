import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';

export async function POST(req) {
  try {
    await initDb();
    const { team_id, business_name, shared_email } = await req.json();

    if (!team_id) return NextResponse.json({ success: false, error: "Team ID required" });

    // 1. Get current team info
    const teamRes = await db.execute({
      sql: "SELECT * FROM v2_teams WHERE id = ? LIMIT 1",
      args: [team_id]
    });
    const team = teamRes.rows[0];
    if (!team) return NextResponse.json({ success: false, error: "Team not found" });

    const finalBusinessName = business_name || team.name;
    const finalEmail = shared_email || `${team.team_username}@impactos.business`;

    // 2. Generate Dual Credentials
    const readKey = Math.random().toString(36).substring(2, 10).toUpperCase();
    const editKey = Math.random().toString(36).substring(2, 10).toUpperCase();
    const registrationId = team.registration_id || `BIZ-${Date.now()}`;

    // 3. Create or Update Family (Business Entity)
    // We check if a family with this name exists, or create a new one.
    const familyCheck = await db.execute({
      sql: "SELECT id FROM families WHERE name = ? LIMIT 1",
      args: [finalBusinessName]
    });

    if (familyCheck.rows.length > 0) {
       await db.execute({
          sql: `UPDATE families SET 
                type = 'company', 
                shared_email = ?, 
                shared_password_read = ?, 
                shared_password_edit = ?,
                program_id = ?
                WHERE id = ?`,
          args: [finalEmail, readKey, editKey, team.program_id, familyCheck.rows[0].id]
       });
    } else {
       await db.execute({
          sql: `INSERT INTO families (id, name, type, registration_id, shared_email, shared_password_read, shared_password_edit, program_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [uuidv4(), finalBusinessName, 'company', registrationId, finalEmail, readKey, editKey, team.program_id]
       });
    }

    // 4. Update Team Meta
    await db.execute({
      sql: "UPDATE v2_teams SET team_type = 'company', name = ? WHERE id = ?",
      args: [finalBusinessName, team_id]
    });

    return NextResponse.json({ 
      success: true, 
      message: "Unit successfully promoted to Business Entity.",
      credentials: {
         email: finalEmail,
         read_key: readKey,
         edit_key: editKey
      }
    });

  } catch (error) {
    console.error("Pivot Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
