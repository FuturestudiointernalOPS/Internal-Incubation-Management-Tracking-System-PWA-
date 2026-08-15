import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { createSession, setSessionCookieOnResponse } from "@/lib/auth";

/**
 * IMPERSONATION ENDPOINT - STAGING ONLY
 *
 * POST: Login as any user without password (creates real session with is_impersonation=true)
 * GET: List available users grouped by role for the dropdown UI
 *
 * Guarded by ALLOW_IMPERSONATION env var. Returns 404 if not enabled.
 */

export async function POST(req) {
  const impersonationAllowed =
    process.env.ALLOW_IMPERSONATION === "true" ||
    process.env.NEXT_PUBLIC_ALLOW_IMPERSONATION === "true";

  console.log("[impersonate:POST] guard check - allowed:", impersonationAllowed, "VERCEL_ENV:", process.env.VERCEL_ENV);

  if (!impersonationAllowed) {
    console.log("[impersonate:POST] BLOCKED - env vars not set");
    return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  }

  try {
    await initDb();
    const body = await req.json();
    const { cid, email: lookupEmail } = body;

    console.log("[impersonate:POST] lookup - cid:", cid, "email:", lookupEmail);

    let userResult = { rows: [] };

    // Try exact CID match first
    if (cid) {
      userResult = await db.execute({
        sql: "SELECT * FROM contacts WHERE cid = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
        args: [cid],
      });
      console.log("[impersonate:POST] CID lookup result rows:", userResult.rows.length);
    }

    // Fallback: lookup by email
    if (userResult.rows.length === 0 && lookupEmail) {
      console.log("[impersonate:POST] Trying email lookup:", lookupEmail);
      userResult = await db.execute({
        sql: "SELECT * FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
        args: [lookupEmail.trim().toLowerCase()],
      });
      console.log("[impersonate:POST] Email lookup result rows:", userResult.rows.length);
    }

    // Last fallback: try cid as email
    if (userResult.rows.length === 0 && cid && cid.includes("@")) {
      console.log("[impersonate:POST] Trying cid as email:", cid);
      userResult = await db.execute({
        sql: "SELECT * FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
        args: [cid.trim().toLowerCase()],
      });
      console.log("[impersonate:POST] CID-as-email lookup result rows:", userResult.rows.length);
    }

    if (userResult.rows.length === 0) {
      console.log("[impersonate:POST] User NOT FOUND");
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    const user = userResult.rows[0];
    console.log("[impersonate:POST] Found user:", user.name, "role:", user.role);

    // Role resolution (same logic as session-login)
    let finalRole = "participant";
    const userCid = user.cid;

    const pmLeadAssignment = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ? LIMIT 1",
      args: [userCid],
    });

    let activeTeammateAssignment = { rows: [] };
    try {
      activeTeammateAssignment = await db.execute({
        sql: "SELECT id::text FROM v2_programs WHERE assigned_assistant_id LIKE ? UNION SELECT id::text FROM v2_teams WHERE handler_id = ? LIMIT 1",
        args: ["%" + userCid + "%", userCid],
      });
    } catch (_) {
      try {
        activeTeammateAssignment = await db.execute({
          sql: "SELECT id::text FROM v2_teams WHERE handler_id = ? LIMIT 1",
          args: [userCid],
        });
      } catch (__) {}
    }

    // External facilitators are program-scoped: only resolved when they hold
    // a facilitator assignment (or carry the facilitator contact role).
    const hasFacilitatorAssignment = async (cid, email) => {
      try {
        const facRes = await db.execute({
          sql: "SELECT 1 FROM v2_program_staff WHERE role = 'facilitator' AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(TRIM(?))) LIMIT 1",
          args: [cid, email || ""],
        });
        return facRes.rows.length > 0;
      } catch (_) {
        return false;
      }
    };

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
    } else if (
      user.role === "staff" || user.role === "project_manager" || user.role === "admin" ||
      (user.group_name || "").toUpperCase() === "FUTURE STUDIO"
    ) {
      // Internal Future Studio staff keep their identity — being assigned as
      // a program assistant / team handler must NOT turn them into a teacher.
      finalRole = "staff";
    } else if (user.role === "facilitator" || (await hasFacilitatorAssignment(userCid, user.email))) {
      finalRole = "facilitator";
    } else if (activeTeammateAssignment.rows.length > 0) {
      finalRole = "teacher";
    } else if (user.role === "teacher") {
      finalRole = "teacher";
    } else if (user.role === "participant") {
      finalRole = "participant";
    }

    console.log("[impersonate:POST] Resolved role:", finalRole);

    // Build response user
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

    // Create impersonation session
    const { token, maxAge } = await createSession(userCid, finalRole, false, true);

    // Determine redirect target
    let target;
    if (finalRole === "super_admin") target = "/admin";
    else if (finalRole === "program_manager") target = "/pm";
    else if (finalRole === "staff") target = "/staff";
    else if (finalRole === "teacher") target = "/teacher";
    else if (finalRole === "developer") target = "/developer";
    else if (finalRole === "investor") target = "/investor/dashboard";
    else if (finalRole === "founder") {
      try {
        const vRes = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE contact_id = ? LIMIT 1", args: [userCid] });
        target = vRes.rows.length > 0 ? "/participant/ventures/" + vRes.rows[0].venture_id : "/participant";
      } catch (_) { target = "/participant"; }
    } else {
      target = "/participant";
    }

    console.log("[impersonate:POST] SUCCESS - redirecting to:", target);

    const response = NextResponse.json({ success: true, user: responseUser, redirect: target });
    return setSessionCookieOnResponse(response, token, maxAge);
  } catch (error) {
    console.error("[impersonate:POST] ERROR:", error.message, error.stack);
    return NextResponse.json({ success: false, error: "Impersonation failed: " + error.message }, { status: 500 });
  }
}

/**
 * GET - list available users for impersonation (staging only)
 */
export async function GET() {
  const impersonationAllowed =
    process.env.ALLOW_IMPERSONATION === "true" ||
    process.env.NEXT_PUBLIC_ALLOW_IMPERSONATION === "true";

  console.log("[impersonate:GET] guard check - allowed:", impersonationAllowed);

  if (!impersonationAllowed) {
    console.log("[impersonate:GET] BLOCKED");
    return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  }

  try {
    await initDb();

    const result = await db.execute({
      sql: "SELECT cid, name, email, role, group_name, status FROM contacts WHERE deleted = 0 AND deleted_at IS NULL AND status IN ('active','approved') ORDER BY role, name",
      args: [],
    });

    console.log("[impersonate:GET] Found", result.rows.length, "active contacts");

    const byRole = {};
    for (const user of result.rows) {
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
        (user.group_name || "").toUpperCase().includes("STAFF") ||
        (user.group_name || "").toUpperCase().includes("FUTURE STUDIO")
      ) {
        displayRole = "staff";
      }

      if (!byRole[displayRole]) byRole[displayRole] = [];
      byRole[displayRole].push({ cid: user.cid, name: user.name, email: user.email, group_name: user.group_name });
    }

    return NextResponse.json({ success: true, users: byRole });
  } catch (error) {
    console.error("[impersonate:GET] ERROR:", error.message);
    return NextResponse.json({ success: false, error: "Failed to list users: " + error.message }, { status: 500 });
  }
}
