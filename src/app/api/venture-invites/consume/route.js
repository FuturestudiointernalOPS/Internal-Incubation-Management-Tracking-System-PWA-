import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// POST /api/venture-invites/consume — external user creates a venture via invite link
export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { token, name, description, industry, business_stage, founder_name, founder_email } = body;

    if (!token) return NextResponse.json({ success: false, error: "Token required" }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ success: false, error: "Venture name is required" }, { status: 400 });
    if (!founder_name?.trim() || !founder_email?.trim()) {
      return NextResponse.json({ success: false, error: "Founder name and email are required" }, { status: 400 });
    }

    // Validate token
    const linkRes = await db.execute({
      sql: "SELECT * FROM venture_invite_links WHERE token = ?",
      args: [token],
    });
    const link = linkRes.rows?.[0];
    if (!link) return NextResponse.json({ success: false, error: "Invalid invitation link" }, { status: 404 });
    if (new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: "This invitation link has expired" }, { status: 410 });
    }
    if (link.uses >= link.max_uses) {
      return NextResponse.json({ success: false, error: "This invitation link has reached its usage limit" }, { status: 410 });
    }

    // Generate venture ID
    const ventureId = `VNT-${uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase()}`;

    // Create venture
    const vRes = await db.execute({
      sql: `INSERT INTO ventures (venture_id, name, company_name, description, industry, business_stage, status, visibility)
            VALUES (?, ?, ?, ?, ?, ?, 'active', 'private') RETURNING id`,
      args: [ventureId, name.trim(), name.trim(), description || null, industry?.trim() || null, business_stage || "idea"],
    });
    const dbId = vRes.rows?.[0]?.id;
    if (!dbId) return NextResponse.json({ success: false, error: "Failed to create venture" }, { status: 500 });

    // Add founder as member (founder type)
    try {
      await db.execute({
        sql: `INSERT INTO venture_members (venture_id, contact_id, member_type, role, permissions)
              SELECT ?, cid, 'founder', 'founder', 'edit' FROM contacts WHERE LOWER(email) = LOWER(?)
              UNION ALL
              SELECT ?, 'new', 'founder', 'founder', 'edit' WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE LOWER(email) = LOWER(?))`,
        args: [dbId, founder_email, dbId, founder_email],
      });
    } catch (e) {
      // non-blocking — member creation may fail if contact doesn't exist yet
    }

    // Increment usage
    await db.execute({
      sql: "UPDATE venture_invite_links SET uses = uses + 1 WHERE token = ?",
      args: [token],
    });

    return NextResponse.json({
      success: true,
      venture_id: ventureId,
      message: "Venture created successfully",
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
