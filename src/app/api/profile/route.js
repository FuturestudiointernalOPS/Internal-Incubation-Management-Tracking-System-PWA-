import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

/**
 * PROFILE COMPLETION API
 *
 * GET  /api/profile — read the current user's profile fields
 * PUT  /api/profile — update profile fields (first-login completion + optional secondary contact info)
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
      sql: "SELECT name, email, phone, address, language, role, group_name FROM contacts WHERE cid = ?",
      args: [session.cid],
    });

    if (res.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const user = res.rows[0];

    // Optional secondary contact fields. These columns may not exist yet in
    // every environment, so this read is best-effort and never fatal.
    let extras = {};
    try {
      const ext = await db.execute({
        sql: "SELECT alternative_email, alternative_phone, country FROM contacts WHERE cid = ?",
        args: [session.cid],
      });
      extras = ext.rows[0] || {};
    } catch (_) {
      extras = {};
    }

    // Determine if profile is complete (name + email mandatory).
    const hasName = user.name && user.name.trim().length > 0;
    const hasEmail = user.email && user.email.trim().length > 0;
    const isComplete = hasName && hasEmail;

    return NextResponse.json({
      success: true,
      profile: {
        cid: session.cid,
        role: user.role,
        group_name: user.group_name,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        language: user.language,
        alternative_email: extras.alternative_email || null,
        alternative_phone: extras.alternative_phone || null,
        country: extras.country || null,
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
    const {
      name,
      phone,
      address,
      language,
      password,
      alternative_email,
      alternative_phone,
      country,
    } = body;

    // Build core update fields
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

    // Self-service password change (session-scoped — only the logged-in user)
    if (password !== undefined) {
      if (String(password).length < 6) {
        return NextResponse.json(
          { success: false, error: "Password must be at least 6 characters" },
          { status: 400 },
        );
      }
      updates.push("password = ?");
      args.push(await bcrypt.hash(String(password), 10));
    }

    // Optional secondary contact fields. Kept separate so a missing column
    // never blocks the core profile save.
    const extUpdates = [];
    const extArgs = [];
    if (alternative_email !== undefined) {
      extUpdates.push("alternative_email = ?");
      extArgs.push(alternative_email || null);
    }
    if (alternative_phone !== undefined) {
      extUpdates.push("alternative_phone = ?");
      extArgs.push(alternative_phone || null);
    }
    if (country !== undefined) {
      extUpdates.push("country = ?");
      extArgs.push(country || null);
    }

    if (updates.length === 0 && extUpdates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    if (updates.length > 0) {
      args.push(session.cid);
      await db.execute({
        sql: `UPDATE contacts SET ${updates.join(", ")} WHERE cid = ?`,
        args,
      });
    }

    if (extUpdates.length > 0) {
      try {
        extArgs.push(session.cid);
        await db.execute({
          sql: `UPDATE contacts SET ${extUpdates.join(", ")} WHERE cid = ?`,
          args: extArgs,
        });
      } catch (_) {
        // Column may not exist yet in this environment. The core fields above
        // have already been persisted, so this is non-fatal.
      }
    }

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
