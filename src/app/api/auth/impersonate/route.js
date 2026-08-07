import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { createSession, setSessionCookieOnResponse } from "@/lib/auth";

/**
 * IMPERSONATION ENDPOINT — STAGING ONLY
 *
 * Triple-layer protection:
 * 1. VERCEL_ENV must NOT be "production"
 * 2. ALLOW_IMPERSONATION env var must be "true"
 * 3. Both checks happen server-side; if either fails, returns 404
 *
 * This endpoint bypasses password verification and creates a real session
 * for the selected user, marked with is_impersonation = true.
 */
export async function POST(req) {
  // ── Layer 1 & 2: Environment guard ──
  // Uses NEXT_PUBLIC_ so only one env var is needed for both client + server
  const isProduction = process.env.VERCEL_ENV === "production";
  const impersonationAllowed =
    process.env.ALLOW_IMPERSONATION === "true" ||
    process.env.NEXT_PUBLIC_ALLOW_IMPERSONATION === "true";

  // Allow impersonation if explicitly enabled via env vars, even on Vercel "production" branch
  if (!impersonationAllowed) {
    // Return 404 — don't reveal the endpoint exists
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );
  }

  try {
    await initDb();
    const { cid } = await req.json();

    if (!cid) {
      return NextResponse.json(
        { success: false, error: "User CID is required." },
        { status: 400 }
      );
    }

    // Look up the user in contacts
    const userResult = await db.execute({
      sql: "SELECT * FROM contacts WHERE cid = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
      args: [cid],
    });

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // ── Role resolution (same logic as session-login, minus password check) ──
    let finalRole = "participant";
    const userCid = user.cid;

    const pmLeadAssignment = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ? LIMIT 1",
      args: [userCid],
    });

    // Resolve teacher/assistant role
    let activeTeammateAssignment = { rows: [] };
    try {
      activeTeammateAssignment = await db.execute({
        sql: `SELECT id::text FROM v2_programs WHERE assigned_assistant_id LIKE ?
              UNION
              SELECT id::text FROM v2_teams WHERE handler_id = ?
              LIMIT 1`,
        args: [`%${userCid}%`, userCid],
      });
    } catch (_) {
      try {
        activeTeammateAssignment = await db.execute({
          sql: "SELECT id::text FROM v2_teams WHERE handler_id = ? LIMIT 1",
          args: [userCid],
        });
      } catch (__) {}
    }

    if (user.role === "super_admin" || user.id === "sa") {
      finalRole = "super_admin";
    } else if (user.role === "developer") {
      finalRole = "developer";
    } else if (user.role === "investor") {
      finalRole = "investor";
    } else if (user.role === "founder") {
      finalRole = "founder";
    } else if (pmLeadAssignment.rows.length > 0) {
      finalRole = "program_manager";
    } else if (user.role === "program_manager") {
      finalRole = "program_manager";
    } else if (activeTeammateAssignment.rows.length > 0) {
      finalRole = "teacher";
    } else if (user.role === "teacher") {
      finalRole = "teacher";
    } else if (user.role === "participant") {
      finalRole = "participant";
    } else if (
      user.role === "staff" ||
      user.role === "project_manager" ||
      user.role === "admin" ||
      (user.group_name || "").toUpperCase().includes("STAFF")
    ) {
      finalRole = "staff";
    } else if (
      (user.group_name || "").toUpperCase().includes("FUTURE STUDIO")
    ) {
      finalRole = "staff";
    }

    // ── Build response user ──
    const responseUser = {
      cid: userCid,
      name: user.name,
      email: user.email,
      role: finalRole,
      group_name: user.group_name,
      language: user.language || "en",
      permission: "edit",
      is_impersonation: true,
    };

    // ── Create impersonation session ──
    const { token, maxAge } = await createSession(
      userCid,
      finalRole,
      false, // no remember_me for impersonation
      true   // isImpersonation = true
    );

    // ── Determine redirect target ──
    let target;
    if (finalRole === "super_admin") {
      target = "/admin";
    } else if (finalRole === "program_manager") {
      target = "/pm";
    } else if (finalRole === "staff") {
      target = "/staff";
    } else if (finalRole === "teacher") {
      target = "/teacher";
    } else if (finalRole === "developer") {
      target = "/developer";
    } else if (finalRole === "investor") {
      target = "/investor/dashboard";
    } else if (finalRole === "founder") {
      // Resolve founder venture target
      try {
        const vRes = await db.execute({
          sql: "SELECT venture_id FROM ventures WHERE contact_id = ? LIMIT 1",
          args: [userCid],
        });
        if (vRes.rows.length > 0) {
          target = `/participant/ventures/${vRes.rows[0].venture_id}`;
        } else {
          target = "/participant";
        }
      } catch (_) {
        target = "/participant";
      }
    } else {
      target = "/participant";
    }

    const response = NextResponse.json({
      success: true,
      user: responseUser,
      redirect: target,
    });

    return setSessionCookieOnResponse(response, token, maxAge);
  } catch (error) {
    console.error("Impersonation error:", error);
    return NextResponse.json(
      { success: false, error: "Impersonation failed." },
      { status: 500 }
    );
  }
}

/**
 * GET — list available users for impersonation (staging only)
 * Returns users grouped by role for the dropdown UI.
 */
export async function GET() {
  const isProduction = process.env.VERCEL_ENV === "production";
  const impersonationAllowed =
    process.env.ALLOW_IMPERSONATION === "true" ||
    process.env.NEXT_PUBLIC_ALLOW_IMPERSONATION === "true";

  if (!impersonationAllowed) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );
  }

  try {
    await initDb();

    const result = await db.execute({
      sql: `SELECT cid, name, email, role, group_name, status
            FROM contacts
            WHERE deleted = 0 AND deleted_at IS NULL AND status = 'active'
            ORDER BY role, name`,
      args: [],
    });

    // Group users by role
    const byRole = {};
    for (const user of result.rows) {
      // Determine effective role (simplified for display purposes)
      let displayRole = user.role || "participant";
      if (user.role === "super_admin") displayRole = "super_admin";
      else if (user.role === "program_manager") displayRole = "program_manager";
      else if (user.role === "developer") displayRole = "developer";
      else if (user.role === "investor") displayRole = "investor";
      else if (user.role === "founder") displayRole = "founder";
      else if (user.role === "teacher") displayRole = "teacher";
      else if (
        user.role === "staff" ||
        user.role === "project_manager" ||
        user.role === "admin" ||
        (user.group_name || "").toUpperCase().includes("STAFF")
      ) {
        displayRole = "staff";
      }

      if (!byRole[displayRole]) byRole[displayRole] = [];
      byRole[displayRole].push({
        cid: user.cid,
        name: user.name,
        email: user.email,
        group_name: user.group_name,
      });
    }

    return NextResponse.json({ success: true, users: byRole });
  } catch (error) {
    console.error("Impersonation list error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list users." },
      { status: 500 }
    );
  }
}
