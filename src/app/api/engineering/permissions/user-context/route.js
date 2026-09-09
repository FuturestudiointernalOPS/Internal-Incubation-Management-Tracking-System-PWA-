import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { resolveAuthorizationContext } from "@/models/authorization/resolver";
import { getContactByCid } from "@/models/responsibilities";

export const dynamic = "force-dynamic";

/**
 * GET /api/engineering/permissions/user-context?cid=X
 *
 * PHASE 2 — read-only administrator view of ONE user's full authorization
 * context. Pure projection of the existing resolver (resolveAuthorizationContext
 * is called unchanged; no authorization semantics are modified). Feeds the
 * Permission Center "User Matrix" (source columns Profile | Group | Grant |
 * Restriction | Effective).
 *
 * Scope is intentionally NOT included: the scope engine is a later phase. The
 * response carries a placeholder so the UI can render the Scope column
 * honestly.
 *
 * Gate: permissions.view_matrix (same as the rest of the Permission Center).
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid")?.trim();
    if (!cid) {
      return NextResponse.json(
        { success: false, error: "cid is required" },
        { status: 400 },
      );
    }

    const contactRes = await getContactByCid(cid);
    const contact = contactRes.rows?.[0];
    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 },
      );
    }

    const ctx = await resolveAuthorizationContext({
      cid,
      role: contact.role || null,
      group_name: contact.group_name || null,
    });

    return NextResponse.json({
      success: true,
      cid,
      role: ctx.role,
      isSuperAdmin: ctx.isSuperAdmin,
      profile: ctx.profile,
      groups: ctx.groups,
      eligibility: ctx.eligibility,
      sources: {
        profile: ctx.baseCaps,
        groups: ctx.groupCaps,
        grants: ctx.grants,
        restrictions: ctx.restrictions,
      },
      effective: ctx.effective,
      scope: { engine: "pending", note: "scope engine arrives in a later phase (P4)" },
    });
  } catch (e) {
    console.error("GET /api/engineering/permissions/user-context error:", e.message);
    return NextResponse.json(
      { success: false, error: e.message || "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
