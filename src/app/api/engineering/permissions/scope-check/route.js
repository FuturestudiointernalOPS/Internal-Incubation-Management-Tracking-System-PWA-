import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import {
  SCOPE_POLICY_KEYS,
  SCOPE_POLICIES,
  isScopePolicyImplemented,
  isWithinScope,
  resolveScopeIds,
} from "@/lib/authorization/scope";

export const dynamic = "force-dynamic";

/**
 * PHASE 5 — Scope verification bench (READ-ONLY).
 *
 * GET /api/engineering/permissions/scope-check
 *     ?policy=venture_own&cid=<user>&resource_id=<record>
 *
 * Lets a Super Admin verify what the Scope Engine decides for a real person
 * and a real record BEFORE any route enforces scope. Nothing here grants or
 * changes access — it only reads the assignment data the predicate uses.
 *
 *   - policy missing/unknown → 400
 *   - unimplemented policy   → 200 with implemented:false, within_scope:false
 *   - resolvable scope       → within_scope true/false + resolved_count + ids
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const policy = searchParams.get("policy");
    const cid = searchParams.get("cid");
    const resourceId = searchParams.get("resource_id");

    if (!policy || !SCOPE_POLICY_KEYS.includes(policy)) {
      return NextResponse.json(
        {
          success: false,
          error: `policy must be one of: ${SCOPE_POLICY_KEYS.join(", ")}`,
        },
        { status: 400 },
      );
    }
    if (!cid) {
      return NextResponse.json(
        { success: false, error: "cid is required" },
        { status: 400 },
      );
    }

    const implemented = isScopePolicyImplemented(policy);
    const ids = await resolveScopeIds(policy, cid);
    const withinScope =
      resourceId && resourceId !== ""
        ? await isWithinScope(policy, cid, resourceId)
        : null;

    return NextResponse.json({
      success: true,
      policy,
      resource: SCOPE_POLICIES[policy].resource,
      source: SCOPE_POLICIES[policy].source,
      implemented,
      cid,
      resource_id: resourceId || null,
      within_scope: withinScope,
      resolved_count: ids ? ids.length : 0,
      resolved_ids: ids || [],
    });
  } catch (err) {
    console.error("[Scope Check] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
