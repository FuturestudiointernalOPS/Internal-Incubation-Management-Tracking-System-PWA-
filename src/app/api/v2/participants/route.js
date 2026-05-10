import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { program_id, name, email, phone, screening_status } = body;

    if (!program_id || !name || !email) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch Program Details for Contextual Branding/Sync
    const progRes = await db.execute({
       sql: "SELECT name FROM v2_programs WHERE id = ?",
       args: [program_id]
    });
    const programName = progRes.rows[0]?.name || "Unassigned Program";

    // 2. Insert into V2 Participants
    const { lastInsertRowid } = await db.execute({
       sql: `INSERT INTO v2_participants (program_id, name, email, phone, screening_status) 
             VALUES (?, ?, ?, ?, ?)`,
       args: [program_id, name, email, phone || null, screening_status || 'applied']
    });

    // 3. FLEXIBLE SYNC: Upsert into V1 Contacts
    // Automatically generate a Participant Password (FSPXXXXX)
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const generatedPassword = `FSP${randomStr}`;

    const contactCheck = await db.execute({
       sql: "SELECT cid FROM contacts WHERE email = ?",
       args: [email]
    });

    if (contactCheck.rows.length > 0) {
       // Update existing contact (preserve password if already exists, else add)
       await db.execute({
          sql: `UPDATE contacts SET 
                name = ?, phone = ?, program_id = ?, program_name = ?, 
                password = COALESCE(password, ?), role = 'participant' 
                WHERE email = ?`,
          args: [name, phone || null, program_id, programName, generatedPassword, email]
       });
    } else {
       // Create new contact with FSP credential
       const cid = `c-${Math.random().toString(36).substr(2, 9)}`;
       await db.execute({
          sql: `INSERT INTO contacts (cid, name, email, phone, program_id, program_name, role, password) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [cid, name, email, phone || null, program_id, programName, 'participant', generatedPassword]
       });
    }

    return NextResponse.json({ 
       success: true, 
       participant: { id: Number(lastInsertRowid), program_id, name, email, phone, screening_status } 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get('program_id');

    let sql = `
      SELECT CAST(id AS TEXT) as id, program_id, name, email, phone, screening_status, created_at, 'MANUAL' as group_name, 'manual' as source
      FROM v2_participants 
      WHERE program_id = ?
      
      UNION
      
      -- Self-Healing Join: Matches contacts via Family Link
      SELECT CAST(c.cid AS TEXT) as id, f.program_id, c.name, c.email, c.phone, 'approved' as screening_status, c.created_at, c.group_name, 'group' as source
      FROM contacts c
      JOIN families f ON UPPER(TRIM(c.group_name)) = UPPER(TRIM(f.name))
      WHERE f.program_id = ?
      
      UNION
      
      -- Direct Profile Link: Matches contacts with program_id in their profile
      SELECT CAST(cid AS TEXT) as id, program_id, name, email, phone, 'approved' as screening_status, created_at, group_name, 'direct' as source
      FROM contacts
      WHERE program_id = ?
      
      UNION
      
      -- Name-Based Fallback: Matches contacts whose group_name matches the program name
      SELECT CAST(c.cid AS TEXT) as id, p.id as program_id, c.name, c.email, c.phone, 'approved' as screening_status, c.created_at, c.group_name, 'fallback' as source
      FROM contacts c
      CROSS JOIN v2_programs p
      WHERE p.id = ? AND UPPER(TRIM(c.group_name)) = UPPER(TRIM(p.name))
      
      ORDER BY created_at DESC
    `;
    
    let args = [program_id, program_id, program_id, program_id];
    
    if (!program_id) {
       sql = "SELECT *, 'manual' as source FROM v2_participants ORDER BY created_at DESC";
       args = [];
    }

    const { rows } = await db.execute({ sql, args });
    return NextResponse.json({ success: true, participants: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
