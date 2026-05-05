import { NextResponse } from "next/server";
import db from "@/lib/db";
import bcrypt from "bcryptjs";

// GET: Validate the token and return program/group info for the UI
export async function GET(req, { params }) {
  try {
    const { token } = await params; // Destructure carefully

    const result = await db.execute({
      sql: `SELECT i.*, p.name as program_name 
            FROM v2_invitations i 
            LEFT JOIN v2_programs p ON i.program_id = p.id 
            WHERE i.token = ? AND i.expires_at > datetime('now')`,
      args: [token]
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Invalid or expired invitation link." }, { status: 404 });
    }

    const invite = result.rows[0];
    return NextResponse.json({ 
      invite: {
        program_id: invite.program_id,
        program_name: invite.program_name,
        group_name: invite.group_name,
        role: invite.role
      } 
    });
  } catch (error) {
    console.error("[Token Validation Error]:", error);
    return NextResponse.json({ error: "Failed to validate token" }, { status: 500 });
  }
}

// POST: Accept invite and register user
export async function POST(req, { params }) {
  try {
    const { token } = await params;
    const { name, email, phone, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
    }

    // 1. Validate Invite
    const inviteCheck = await db.execute({
      sql: "SELECT * FROM v2_invitations WHERE token = ? AND expires_at > datetime('now')",
      args: [token]
    });

    if (inviteCheck.rows.length === 0) {
      return NextResponse.json({ error: "Invalid or expired invitation link." }, { status: 404 });
    }
    const invite = inviteCheck.rows[0];

    // 2. Hash Password & Prepare User (Ticket 2 - Auth System)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const cid = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    // 3. Upsert User into Contacts
    let contactId;
    const existingUser = await db.execute({
      sql: "SELECT * FROM contacts WHERE email = ?",
      args: [email]
    });

    if (existingUser.rows.length > 0) {
      // User exists, update their profile with the new invite credentials and group
      await db.execute({
        sql: `UPDATE contacts 
              SET name = ?, phone = ?, password = ?, role = ?, group_name = ?, team_id = ? 
              WHERE email = ?`,
        args: [name, phone || null, hashedPassword, invite.role, invite.group_name, invite.team_id || null, email]
      });
      contactId = existingUser.rows[0].cid;
    } else {
      // Create new user
      await db.execute({
        sql: `INSERT INTO contacts (cid, name, email, phone, password, role, group_name, team_id) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [cid, name, email, phone || null, hashedPassword, invite.role, invite.group_name, invite.team_id || null]
      });
      contactId = cid;
    }

    // 4. Map user to v2_participants to prevent duplicate joins
    const participantCheck = await db.execute({
      sql: "SELECT id FROM v2_participants WHERE email = ? AND program_id = ?",
      args: [email, invite.program_id]
    });

    if (participantCheck.rows.length > 0) {
      // Update existing participant record if they are re-joining with a team
      await db.execute({
        sql: "UPDATE v2_participants SET team_id = ? WHERE email = ? AND program_id = ?",
        args: [invite.team_id || null, email, invite.program_id]
      });
    } else {
      await db.execute({
        sql: `INSERT INTO v2_participants (program_id, name, email, phone, status, team_id) 
              VALUES (?, ?, ?, ?, 'Active', ?)`,
        args: [invite.program_id, name, email, phone || null, invite.team_id || null]
      });
    }

    return NextResponse.json({ 
      message: "Successfully joined the team!", 
      user: { cid: contactId, name, email, role: invite.role }
    });

  } catch (error) {
    console.error("[Invite Acceptance Error]:", error);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}
