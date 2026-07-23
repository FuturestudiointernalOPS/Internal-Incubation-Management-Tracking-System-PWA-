import { NextResponse } from "next/server";
import db from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { createHandler } from "@/lib/api/createHandler";

export const POST = createHandler({ roles: ["staff", "super_admin"] }, async (req) => {
  const {
    program_id,
    group_name,
    team_id,
    role = "participant",
    expiresInDays = 7,
    expiresInHours,
    } = await req.json();

  if (!program_id) {
    return NextResponse.json(
      { error: "Program ID is required" },
      { status: 400 },
    );
  }

  // Ensure table exists
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS v2_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        program_id TEXT NOT NULL,
        group_name TEXT,
        team_id TEXT,
        role TEXT DEFAULT 'participant',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      args: [],
    });
  } catch (_) {}

  const token = uuidv4();
  const expiresAt = new Date();

  if (expiresInHours) {
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);
  } else {
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  try {
    await db.execute({
      sql: `INSERT INTO v2_invitations (token, program_id, group_name, team_id, role, email, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        token,
        program_id,
        group_name || null,
        team_id || null,
        role,
        '',
        expiresAt.toISOString().replace("T", " ").replace("Z", ""),
      ],
    });

    // Detect the base URL dynamically from the request headers
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host");
    const baseUrl = `${protocol}://${host}`;
    const inviteUrl = `${baseUrl}/invite/${token}`;

    return NextResponse.json({
      message: "Invite generated successfully",
      token,
      inviteUrl,
      expiresAt,
    });
  } catch (error) {
    console.error("[Invite Generation Error]:", error.message, error.stack);
    return NextResponse.json(
      { error: "Failed to generate invite: " + error.message },
      { status: 500 },
    );
  }
});

export async function GET(req) {
  try {
    // Optionally fetch active invites for a specific program
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");

    let query =
      "SELECT * FROM v2_invitations WHERE expires_at > datetime('now')";
    let args = [];

    if (program_id) {
      query += " AND program_id = ?";
      args.push(program_id);
    }

    const result = await db.execute({ sql: query, args });
    return NextResponse.json({ invites: result.rows });
  } catch (error) {
    console.error("[Fetch Invites Error]:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 },
    );
  }
}
