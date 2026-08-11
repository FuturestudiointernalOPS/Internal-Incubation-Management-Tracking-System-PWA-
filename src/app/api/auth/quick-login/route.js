import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

/**
 * QUICK LOGIN - Staging-only endpoint.
 * Logs in as any user by email. No password required.
 * Creates a real session with is_impersonation=true.
 */
export async function POST(req) {
  // Guard
  const allowed =
    process.env.ALLOW_IMPERSONATION === "true" ||
    process.env.NEXT_PUBLIC_ALLOW_IMPERSONATION === "true";
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await initDb();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Find user by email
    const result = await db.execute({
      sql: "SELECT * FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
      args: [email.trim().toLowerCase()],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = result.rows[0];

    // Resolve role (same as session-login)
    let finalRole = "participant";
    const userCid = user.cid;

    if (user.role === "super_admin" || user.id === "sa") finalRole = "super_admin";
    else if (user.role === "developer") finalRole = "developer";
    else if (user.role === "investor") finalRole = "investor";
    else if (user.role === "founder") finalRole = "founder";
    else if (user.role === "program_manager") finalRole = "program_manager";
    else if (user.role === "teacher") finalRole = "teacher";
    else if (user.role === "staff" || user.role === "admin" || (user.group_name || "").toUpperCase().includes("STAFF")) finalRole = "staff";
    else if ((user.group_name || "").toUpperCase().includes("FUTURE STUDIO")) finalRole = "staff";

    // Also check pm assignment
    if (finalRole === "participant") {
      try {
        const pmCheck = await db.execute({
          sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ? LIMIT 1",
          args: [userCid],
        });
        if (pmCheck.rows.length > 0) finalRole = "program_manager";
      } catch (_) {}
    }

    // Create session directly
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const expiresAtStr = expiresAt.toISOString().replace("T", " ").replace("Z", "");

    await db.execute({
      sql: "INSERT INTO user_sessions (token, user_cid, role, expires_at, is_impersonation) VALUES (?, ?, ?, ?, ?)",
      args: [token, userCid, finalRole, expiresAtStr, 1],
    });

    // Determine redirect
    let target = "/participant";
    if (finalRole === "super_admin") target = "/admin";
    else if (finalRole === "program_manager") target = "/pm";
    else if (finalRole === "staff") target = "/staff";
    else if (finalRole === "teacher") target = "/teacher";
    else if (finalRole === "developer") target = "/developer";
    else if (finalRole === "investor") target = "/investor/dashboard";
    else if (finalRole === "founder") target = "/participant/ventures";

    // Set cookie and respond
    const response = NextResponse.json({
      success: true,
      user: {
        cid: userCid,
        name: user.name,
        email: user.email,
        role: finalRole,
        group_name: user.group_name,
        language: user.language || "en",
        is_impersonation: true,
      },
      redirect: target,
    });

    response.cookies.set("impactos_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("[quick-login] ERROR:", error.message);
    return NextResponse.json({ error: "Login failed: " + error.message }, { status: 500 });
  }
}
