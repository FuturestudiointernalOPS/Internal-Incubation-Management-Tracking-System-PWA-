import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession, setSessionCookieOnResponse } from "@/lib/auth";

export async function POST(req) {
  try {
    await initDb();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password required." },
        { status: 400 },
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Find user
    const result = await db.execute({
      sql: "SELECT * FROM contacts WHERE (email = ? OR cid = ?) AND deleted = 0 LIMIT 1",
      args: [cleanEmail, cleanEmail],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials." },
        { status: 401 },
      );
    }

    const user = result.rows[0];

    // Verify password
    const isHashed = user.password && user.password.startsWith("$2");
    let isMatch = false;

    if (isHashed) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = password === user.password;
    }

    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials." },
        { status: 401 },
      );
    }

    // Check status - only ACTIVE users can log in
    if (user.status === "pending") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your account is pending approval. Please wait for an administrator to approve your account.",
        },
        { status: 403 },
      );
    }

    if (user.status === "inactive" || user.status === "suspended") {
      return NextResponse.json(
        {
          success: false,
          error: "Your account has been suspended. Contact your administrator.",
        },
        { status: 403 },
      );
    }

    // Resolve role (same logic as existing login)
    let finalRole = "participant";

    const pmLeadAssignment = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ? LIMIT 1",
      args: [user.cid],
    });

    const activeTeammateAssignment = await db.execute({
      sql: `SELECT id FROM v2_programs WHERE assigned_assistant_id LIKE ?
            UNION
            SELECT id FROM v2_teams WHERE handler_id = ?
            LIMIT 1`,
      args: [`%${user.cid}%`, user.cid],
    });

    if (user.role === "super_admin" || user.id === "sa") {
      finalRole = "super_admin";
    } else if (pmLeadAssignment.rows.length > 0) {
      finalRole = "program_manager";
    } else if (activeTeammateAssignment.rows.length > 0) {
      finalRole = "teacher";
    } else if (
      user.role === "staff" ||
      user.role === "project_manager" ||
      user.role === "admin" ||
      user.group_name?.toUpperCase() === "STAFF" ||
      user.group_name?.toUpperCase() === "FUTURE STUDIO"
    ) {
      finalRole = "staff";
    }

    // Create session (DB insert) and get token
    const { token, maxAge } = await createSession(user.cid, finalRole);

    // Build response and set cookie directly on it
    const response = NextResponse.json({
      success: true,
      user: {
        cid: user.cid,
        name: user.name,
        email: user.email,
        role: finalRole,
        group_name: user.group_name,
        language: user.language || "en",
      },
    });

    return setSessionCookieOnResponse(response, token, maxAge);
  } catch (error) {
    console.error("Session login error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication system failure." },
      { status: 500 },
    );
  }
}
