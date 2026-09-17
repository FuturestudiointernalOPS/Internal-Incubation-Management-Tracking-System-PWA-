import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { getSession, logPermissionAudit } from "@/lib/auth";
import { repointProgramManagerDefaultToPortfolio } from "@/models/authorization/programAssignmentBackfill";
import { buildProgramScopeReadiness } from "@/models/authorization/programScopeReadiness";

export const dynamic = "force-dynamic";

/**
 * PUT /api/engineering/permissions/program-portfolio-default
 *     requires permissions.assign_capabilities
 *
 * THE DELIBERATE CLICK behind the template split (step 3).
 *
 * Creating the trimmed portfolio template changes nobody. Pointing the
 * programme-manager role default AT it is what removes `ventures.edit` and
 * `contacts.create` from everyone who resolves through their identity — a job
 * that belongs to the venture and CRM responsibilities, not to programme
 * management.
 *
 * It is an action with an audit record rather than a boot-time migration, on
 * purpose: a change that removes access for a group of people should be somebody's
 * decision, made with the impact in front of them, and reversible.
 *
 * The IMPACT is read BEFORE the repoint and returned alongside the result, so the
 * caller can show what actually changed rather than only that it succeeded.
 * Refuses to overwrite a default an administrator set on purpose.
 *
 * GET reports what the repoint WOULD do without doing it, so a screen can show
 * the consequence first.
 */
export async function GET() {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const readiness = await buildProgramScopeReadiness();
    return NextResponse.json({
      success: true,
      impact: {
        removals: readiness.removals,
        portfolioTemplates: readiness.portfolioTemplates,
        // Everyone on a template that grants programme editing: the population
        // the split moves between templates.
        peopleAffected: readiness.summary.holders,
      },
    });
  } catch (err) {
    console.error("[Program Portfolio Default] read error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function PUT() {
  try {
    const capError = await requireAuthorization(
      "permissions",
      "assign_capabilities",
    );
    if (capError) return capError;

    // Read the impact first — it is what the audit record and the response mean
    // by "what changed".
    const before = await buildProgramScopeReadiness();

    const result = await repointProgramManagerDefaultToPortfolio();

    if (!result.success && result.error === "role-default-customized") {
      return NextResponse.json(
        {
          success: false,
          error: "errors.insufficientPermissions",
          reason: "role-default-customized",
          currentProfileId: result.currentProfileId,
        },
        { status: 409 },
      );
    }
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "errors.somethingWrong" },
        { status: 500 },
      );
    }

    if (result.changed) {
      const session = await getSession();
      await logPermissionAudit({
        actorCid: session?.cid || null,
        actorName: session?.name || null,
        targetCid: null,
        targetName: `role default: ${result.from || "none"}`,
        action: "access_profile_changed",
        module: "permissions",
        capability: "assign_capabilities",
        previousValue: result.from || "none",
        newValue: result.to,
        details:
          "Program manager role default repointed at the portfolio template (the assignment template covers one programme)",
      });
    }

    return NextResponse.json({
      success: true,
      changed: result.changed,
      reason: result.reason || null,
      to: result.to,
      from: result.from || null,
      // What the repoint took away, so the response is a statement of effect
      // rather than of success.
      removed: before.removals.map((r) => `${r.module}.${r.capability}`),
      peopleAffected: before.summary.holders,
    });
  } catch (err) {
    console.error("[Program Portfolio Default] write error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
