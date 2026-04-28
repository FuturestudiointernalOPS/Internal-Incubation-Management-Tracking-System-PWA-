import { NextResponse } from "next/server";
import db from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(req) {
  try {
    const { program_id, group_name, role = 'participant', expiresInDays = 7, expiresInHours, created_by } = await req.json();

    if (!program_id) {
      return NextResponse.json({ error: "Program ID is required" }, { status: 400 });
    }

    const token = uuidv4();
    const expiresAt = new Date();
    
    if (expiresInHours) {
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    } else {
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    await db.execute({
      sql: `INSERT INTO v2_invitations (token, program_id, group_name, role, expires_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [token, program_id, group_name || null, role, expiresAt.toISOString(), created_by || 'admin']
    });

    // In a real environment, you'd pull the BASE_URL from env
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${token}`;

    return NextResponse.json({ 
      message: "Invite generated successfully", 
      token, 
      inviteUrl,
      expiresAt 
    });
  } catch (error) {
    console.error("[Invite Generation Error]:", error);
    return NextResponse.json({ error: "Failed to generate invite" }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    // Optionally fetch active invites for a specific program
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get('program_id');

    let query = "SELECT * FROM v2_invitations WHERE expires_at > datetime('now')";
    let args = [];

    if (program_id) {
      query += " AND program_id = ?";
      args.push(program_id);
    }

    const result = await db.execute({ sql: query, args });
    return NextResponse.json({ invites: result.rows });
  } catch (error) {
    console.error("[Fetch Invites Error]:", error);
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
  }
}
