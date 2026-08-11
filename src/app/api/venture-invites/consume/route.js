import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

// POST /api/venture-invites/consume — external user creates a venture via invite link
export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { token, name, description, industry, business_stage, founder_name, founder_email, founder_password } = body;

    if (!token) return NextResponse.json({ success: false, error: "Token required" }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ success: false, error: "Venture name is required" }, { status: 400 });
    if (!founder_name?.trim() || !founder_email?.trim()) {
      return NextResponse.json({ success: false, error: "Founder name and email are required" }, { status: 400 });
    }
    if (!founder_password || founder_password.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters" }, { status: 400 });
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

    // Create venture — pending until a super admin approves it
    const vRes = await db.execute({
      sql: `INSERT INTO ventures (venture_id, name, company_name, description, industry, business_stage, status, visibility)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', 'private') RETURNING id`,
      args: [ventureId, name.trim(), name.trim(), description || null, industry?.trim() || null, business_stage || "idea"],
    });
    const dbId = vRes.rows?.[0]?.id;
    if (!dbId) return NextResponse.json({ success: false, error: "Failed to create venture" }, { status: 500 });

    // Add founder as member (founder type)
    // Resolve the contact by email — create it with the founder's password so they
    // can log in immediately (no email round-trip needed).
    const hashedPassword = await bcrypt.hash(founder_password, 10);
    let contactCid = null;
    try {
      const existing = await db.execute({
        sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?)",
        args: [founder_email],
      });
      contactCid = existing.rows?.[0]?.cid || null;
    } catch {}
    if (contactCid) {
      // Contact already exists (e.g. placeholder from an earlier attempt) — set the real password
      try {
        await db.execute({
          sql: "UPDATE contacts SET password = ?, name = ?, role = 'founder', status = 'active' WHERE cid = ?",
          args: [hashedPassword, founder_name.trim(), contactCid],
        });
      } catch (e) {
        console.warn("Failed to update founder contact password:", e.message);
      }
    } else {
      try {
        const newCid = `USER_${uuidv4().toUpperCase().replace(/-/g, "").substring(0, 12)}`;
        const ins = await db.execute({
          sql: `INSERT INTO contacts (cid, name, email, password, role, status, deleted)
                VALUES (?, ?, ?, ?, 'founder', 'active', 0) RETURNING cid`,
          args: [newCid, founder_name.trim(), founder_email.trim(), hashedPassword],
        });
        contactCid = ins.rows?.[0]?.cid || newCid;
      } catch (e) {
        console.warn("Failed to create founder contact:", e.message);
      }
    }
    if (contactCid) {
      try {
        // venture_members stores venture_id as the VNT code (TEXT), not the internal UUID
        await db.execute({
          sql: `INSERT INTO venture_members (venture_id, contact_id, member_type, role, permissions)
                VALUES (?, ?, 'founder', 'founder', 'edit') ON CONFLICT DO NOTHING`,
          args: [ventureId, contactCid],
        });
      } catch (e) {
        console.warn("Failed to add founder as member:", e.message);
      }
      try {
        // Also record the founder in venture_founders so the Founder Management UI shows them
        await db.execute({
          sql: `INSERT INTO venture_founders (venture_id, email, name, role, is_owner, status)
                VALUES (?, ?, ?, 'founder', TRUE, 'active')
                ON CONFLICT DO NOTHING`,
          args: [ventureId, founder_email.trim(), founder_name.trim()],
        });
      } catch (e) {
        console.warn("Failed to add founder to venture_founders:", e.message);
      }
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
