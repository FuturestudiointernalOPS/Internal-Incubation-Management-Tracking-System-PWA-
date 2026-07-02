import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

/**
 * PROFILE COMPLETION API
 *
 * GET  /api/profile — check if current user has completed mandatory profile fields
 * PUT  /api/profile — update profile fields (first-login completion)
 */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    await initDb();
    const res = await db.execute({
      sql: "SELECT name, email, phone, address, language, profile_completed, supervisor_cid FROM contacts WHERE cid = ?",
      args: [session.cid],
    });

    if (res.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const user = res.rows[0];

    // Determine if profile is complete (name + email mandatory, phone strongly recommended)
    const hasName = user.name && user.name.trim().length > 0;
    const hasEmail = user.email && user.email.trim().length > 0;
    const isComplete = hasName && hasEmail;

    return NextResponse.json({
      success: true,
      profile: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        language: user.language,
        profile_completed: !!user.profile_completed,
        supervisor_cid: user.supervisor_cid,
      },
      mandatory: { name: !hasName, email: !hasEmail },
      isComplete,
    });
  } catch (err) {
    console.error("[Profile] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    await initDb();
    const body = await req.json();
    const { name, phone, address, language } = body;

    // Build update fields
    const updates = [];
    const args = [];

    if (name !== undefined) {
      updates.push("name = ?");
      args.push(name.trim());
    }
    if (phone !== undefined) {
      updates.push("phone = ?");
      args.push(phone || null);
    }
    if (address !== undefined) {
      updates.push("address = ?");
      args.push(address || null);
    }
    if (language !== undefined) {
      updates.push("language = ?");
      args.push(language);
    }

    // Auto-mark profile as completed when at least name is provided
    if (name !== undefined && name.trim().length > 0) {
      updates.push("profile_completed = 1");
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    args.push(session.cid);
    await db.execute({
      sql: `UPDATE contacts SET ${updates.join(", ")} WHERE cid = ?`,
      args,
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated",
      profile_completed: name !== undefined && name.trim().length > 0,
    });
  } catch (err) {
    console.error("[Profile] PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
