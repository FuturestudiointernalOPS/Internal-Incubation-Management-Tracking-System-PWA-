import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { resolveAuthorizationContext } from "@/models/authorization/resolver";
import { getContactContexts } from "@/models/authorization/contactContexts";
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
 * Scope is included as CONTEXTS, not as a second verdict: the list is produced
 * by the same data-layer predicates the Scope Engine enforces from, so the
 * screen can say where each relationship sits without inventing a decision.
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

    // Contextual relationships (UI-4c): additive, per context, read from the
    // same assignment data the scope predicates use. Fail-soft per kind — an
    // unreadable lookup is reported, never flattened into "no memberships".
    const contextData = await getContactContexts(cid, {
      email: contact.email || null,
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
      contexts: contextData.contexts,
      contextsUnavailable: contextData.unavailable,
      scope: {
        engine: "implemented",
        note: "venture_own · program_assigned · learning_own (team_own pending)",
      },
    });
  } catch (e) {
    console.error("GET /api/engineering/permissions/user-context error:", e.message);
    return NextResponse.json(
      { success: false, error: e.message || "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
