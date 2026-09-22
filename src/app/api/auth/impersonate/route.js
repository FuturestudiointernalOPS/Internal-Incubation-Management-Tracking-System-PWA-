import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { createSession, setSessionCookieOnResponse } from "@/lib/auth";
import { resolveLanding, landingNeedsRelationships } from "@/lib/platform/roles";
import { getVentureMembershipsForContact } from "@/models/contacts";
import {
  getImpersonationTargetByCid,
  getImpersonationTargetByEmail,
  getImpersonationTargetUsingCidAsEmail,
  listActiveContactsForImpersonation,
} from "@/models/authFlows";

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

  const isProduction =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";
  if (isProduction) {
    console.log("[impersonate:POST] BLOCKED - production environment");
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
      userResult = await getImpersonationTargetByCid(cid);
      console.log("[impersonate:POST] CID lookup result rows:", userResult.rows.length);
    }

    // Fallback: lookup by email
    if (userResult.rows.length === 0 && lookupEmail) {
      console.log("[impersonate:POST] Trying email lookup:", lookupEmail);
      userResult = await getImpersonationTargetByEmail(
        lookupEmail.trim().toLowerCase(),
      );
      console.log("[impersonate:POST] Email lookup result rows:", userResult.rows.length);
    }

    // Last fallback: try cid as email
    if (userResult.rows.length === 0 && cid && cid.includes("@")) {
      console.log("[impersonate:POST] Trying cid as email:", cid);
      userResult = await getImpersonationTargetUsingCidAsEmail(
        cid.trim().toLowerCase(),
      );
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

    // External facilitators are program-scoped; the explicit role branch below
    // remains the only way to receive the facilitator global role at login.

    if (user.role === "super_admin" || user.id === "sa") {
      finalRole = "super_admin";
    } else if (user.role === "developer") {
      finalRole = "developer";
    } else if (user.role === "investor") {
      finalRole = "investor";
    } else if (user.role === "founder") {
      finalRole = "founder";
    } else if (user.role === "program_manager") {
      finalRole = "program_manager";
    } else if (
      user.role === "staff" || user.role === "project_manager" || user.role === "admin" ||
      (user.group_name || "").toUpperCase() === "FUTURE STUDIO"
    ) {
      // Internal Future Studio staff keep their identity — being assigned as
      // a program assistant / team handler must NOT change their identity.
      finalRole = "staff";
    } else if (user.role === "facilitator") {
      finalRole = "facilitator";
    } else if (user.role === "participant") {
      finalRole = "participant";
    }

    console.log("[impersonate:POST] Resolved role:", finalRole);

    const { logAuditEvent } = await import("@/lib/audit");
    await logAuditEvent({
      entity_type: "auth",
      entity_id: user.cid,
      user_id: user.cid,
      user_name: user.name || "",
      action: "impersonate",
      details: `Impersonation session created for ${user.email || user.cid}`,
      metadata: { target_role: finalRole, source: "impersonate" },
    });

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

    // Where this person belongs — the SAME rule the real login uses, from the
    // same relationships, instead of the role chain that used to live here.
    // Impersonation is how a screen gets exercised, so it must land exactly
    // where the person it impersonates would.
    let ventureMemberships = [];
    if (landingNeedsRelationships(finalRole)) {
      try {
        const vm = await getVentureMembershipsForContact(userCid);
        ventureMemberships = vm.rows || [];
      } catch (_) {}
    }
    const home = resolveLanding({ role: finalRole, ventures: ventureMemberships });
    responseUser.home = home;

    console.log("[impersonate:POST] SUCCESS - redirecting to:", home);

    const response = NextResponse.json({ success: true, user: responseUser, redirect: home });
    return setSessionCookieOnResponse(
      response,
      token,
      maxAge,
      req.headers.get("host"),
    );
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

  const isProduction =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";
  if (isProduction) {
    console.log("[impersonate:GET] BLOCKED - production environment");
    return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  }

  try {
    await initDb();

    const result = await listActiveContactsForImpersonation();

    console.log("[impersonate:GET] Found", result.rows.length, "active contacts");

    const byRole = {};
    for (const user of result.rows) {
      let displayRole = user.role || "participant";
      if (user.role === "super_admin") displayRole = "super_admin";
      else if (user.role === "program_manager") displayRole = "program_manager";
      else if (user.role === "developer") displayRole = "developer";
      else if (user.role === "investor") displayRole = "investor";
      else if (user.role === "founder") displayRole = "founder";
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
