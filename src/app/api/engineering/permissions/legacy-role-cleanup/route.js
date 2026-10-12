import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { logPermissionAudit } from "@/models/authorization/accessQueries";
import { requireAuthorization } from "@/models/authorization/index";
import { requireSameOrigin } from "@/lib/requestOrigin";
import {
  surveyLegacyRoles,
  alignLegacyRoles,
} from "@/services/authorization/legacyRoleCleanup";

export const dynamic = "force-dynamic";

/**
 * LEGACY GLOBAL-ROLE CLEANUP API (Phase H).
 *
 *   GET  requires permissions.view_matrix
 *        → the "relevé": every `contacts.role` value in use, split into the
 *        baseline identities and the LEGACY values, with the accounts behind
 *        each legacy value and the `safe` gate (true only when no account
 *        carries a legacy value). Same-origin only (CSRF-1).
 *
 *   POST requires permissions.configure_eligibility
 *        body: { role?: string, reason?: string }
 *        → align one legacy value (or every legacy value when `role` is
 *        omitted) onto the baseline. Additive: only the role COLUMN is
 *        rewritten, guarded by the exact legacy value; relationships and
 *        profile cards are untouched.
 *
 * The report is the Phase H "preuve de zéro dépendance" — the screen an
 * administrator reads BEFORE pressing the alignment, and the proof that once it
 * reports `safe: true`, no access depends on a legacy role value.
 */
export async function GET(req) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const report = await surveyLegacyRoles();
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    console.error("[Legacy Role Cleanup] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const capError = await requireAuthorization("permissions", "configure_eligibility");
    if (capError) return capError;

    await initDb();
    const session = await getSession();
    const body = await req.json().catch(() => ({}));
    const role = body?.role ? String(body.role) : null;

    const result = await alignLegacyRoles({ roleValue: role });
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    const alignedTotal = result.aligned.reduce((sum, entry) => sum + entry.aligned, 0);
    if (alignedTotal > 0) {
      const reasonNote =
        body?.reason && typeof body.reason === "string" && body.reason.trim()
          ? ` Reason: ${body.reason.trim()}`
          : "";
      await logPermissionAudit({
        actorCid: session?.cid,
        actorName: session?.name,
        targetCid: "system",
        targetName: role || "all-legacy-roles",
        action: "legacy_roles_aligned",
        details: `Aligned legacy contacts.role to ${result.toRole}: ${result.aligned
          .map((entry) => `${entry.role}(${entry.aligned})`)
          .join(", ")}${reasonNote}`,
      });
    }

    return NextResponse.json({
      success: true,
      aligned: result.aligned,
      skipped: result.skipped,
      aligned_total: alignedTotal,
    });
  } catch (error) {
    console.error("[Legacy Role Cleanup] POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
