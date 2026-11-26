import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";
import { requireAuthorization } from "@/models/authorization/index";
import { getContactNameAndRole } from "@/models/authorization";
import { preparePermissionReads, readPermissionMatrix } from "@/services/authorization/permissionMatrix";
import { applyPermissionChange } from "@/services/authorization/permissionWrites";
import { isSelfAssignment } from "@/services/authorization/profileAssignment";

/**
 * §13 (séparation des devoirs) — actions that change a PERSON's own access and
 * must never be applied to the caller themselves.
 */
const SELF_SENSITIVE_ACTIONS = new Set([
  "grant",
  "revoke",
  "restrict",
  "unrestrict",
  "set_role",
  "set_status",
]);

/**
 * GET /api/engineering/permissions
 *
 * Returns the full permission matrix definition and user capability data.
 * Query params:
 *   ?user_cid=X  — get effective permissions for a specific user
 *   ?group=Development — get group defaults for a specific group
 *
 * Role-level defaults are no longer stored per capability: a role names a
 * default PROFILE, and that profile carries the capabilities.
 */
// Resilient reads: a missing table (migration not yet applied) must never 500
// the whole permissions page — the model's list helpers degrade to an empty
// list (see runSafeQuery in @/models/authorization).

export async function GET(req) {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await initDb();
    await preparePermissionReads();

    const { searchParams } = new URL(req.url);
    // The read assembly (table users, catalog, one user's matrix, role/group
    // defaults) and the branch order live in the service.
    const { status, body } = await readPermissionMatrix({
      users: searchParams.get("users"),
      userCid: searchParams.get("user_cid"),
      group: searchParams.get("group"),
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("[Permissions] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/engineering/permissions
 *
 * Manage individual user permissions.
 * Body: { action, user_cid, module, capability, access_level, expires_at }
 *   action: 'grant' | 'revoke' | 'restrict' | 'unrestrict'
 */
export async function PUT(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    }
    const actor = { cid: session.cid, name: session.name };

    const body = await req.json();
    const { action, user_cid, module, capability, access_level, expires_at } = body;

    if (!action || !user_cid) {
      return NextResponse.json(
        { success: false, error: "action and user_cid are required" },
        { status: 400 },
      );
    }

    // Promoting to Super Admin (or demoting) is a ROLE change, but it is still
    // a RIGHT: `permissions.promote_super_admin` / `remove_super_admin` are in
    // the catalogue, so an administrator can delegate them — and, like every
    // other right, they can be revoked from the owner too.
    if (action === "promote_super_admin") {
      const promoteError = await requireAuthorization(
        "permissions",
        "promote_super_admin",
      );
      if (promoteError) return promoteError;
    }

    if (action === "remove_super_admin") {
      const removeError = await requireAuthorization(
        "permissions",
        "remove_super_admin",
      );
      if (removeError) return removeError;
    }

    // §13 — separation of duties: nobody changes their OWN access through this
    // admin route (self-escalation). The context targets a PERSON.
    if (SELF_SENSITIVE_ACTIONS.has(action) && isSelfAssignment(session, user_cid)) {
      return NextResponse.json(
        { success: false, error: "errors.cannotChangeOwnAccess" },
        { status: 403 },
      );
    }

    // §13 — only the holder of `promote_super_admin` may assign the super_admin
    // role. Without this, `set_role` would bypass the promote gate just above.
    if (action === "set_role" && String(body.role || "") === "super_admin") {
      const promoteError = await requireAuthorization(
        "permissions",
        "promote_super_admin",
      );
      if (promoteError) return promoteError;
    }

    // Taking the role AWAY from a Super Admin is the symmetric right: a
    // `set_role` on a current owner is a demotion and needs
    // `remove_super_admin` BEFORE the write (the target is read through the
    // model layer, so this runs after the schema is ready).
    await initDb();
    await ensurePermissionsSchema();

    if (action === "set_role" && String(body.role || "") !== "super_admin") {
      const target = await getContactNameAndRole(user_cid);
      if (String(target.rows?.[0]?.role || "") === "super_admin") {
        const removeError = await requireAuthorization(
          "permissions",
          "remove_super_admin",
        );
        if (removeError) return removeError;
      }
    }

    // The action switch, the eligibility boundary and the audit trail live in
    // the service.
    const { status, body: out } = await applyPermissionChange({
      action,
      userCid: user_cid,
      module,
      capability,
      accessLevel: access_level,
      expiresAt: expires_at,
      payload: body,
      actor,
    });
    return NextResponse.json(out, { status });
  } catch (error) {
    console.error("[Permissions] PUT error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

