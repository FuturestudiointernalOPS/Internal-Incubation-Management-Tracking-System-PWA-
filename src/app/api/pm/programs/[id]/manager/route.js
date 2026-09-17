import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { getProgramManager, setProgramManager } from "@/models/programs";
import { getContactNameAndRole } from "@/models/authorization";
import { syncContextGrantsForUser } from "@/models/authorization/contextGrants";

export const dynamic = "force-dynamic";

/**
 * PUT /api/pm/programs/[id]/manager
 *     body: { manager_cid: string | null }
 *     requires programs.edit
 *
 * Record who manages a program — the REPAIR action behind the readiness report.
 *
 * WHY IT MATTERS: the program scope rule matches a person to a program through
 * the manager relationship. A running program with no manager recorded can never
 * be matched, so enforcing the rule before repairing the data would make that
 * program unreachable to everyone except the portfolio identity. The readiness
 * report lists exactly those programs; this is the action that clears one.
 *
 * ASSIGNMENT-DERIVED ACCESS FOLLOWS THE RELATIONSHIP. Two people change when the
 * manager changes, so both are reconciled here:
 *
 *   - the NEW manager receives the assignment-derived capabilities for this
 *     program (additive, expiring with the program);
 *   - the PREVIOUS manager's grants are reconciled too, which withdraws the ones
 *     this program alone justified.
 *
 * A manual grant and an explicit block are never touched by either reconcile:
 * grants carry the mechanism's own stamp, and blocks live outside the merge.
 *
 * The capability is `programs.edit` — changing who runs a program is a program
 * management write, not a permissions-console write. Super Admin passes through
 * the resolver; a permission administrator without that capability does not.
 */
export async function PUT(req, { params }) {
  try {
    await initDb();

    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const managerCid =
      body?.manager_cid === undefined ? undefined : body.manager_cid;

    if (managerCid === undefined) {
      return NextResponse.json(
        { success: false, error: "manager_cid is required" },
        { status: 400 },
      );
    }

    const current = await getProgramManager(id);
    const program = current.rows?.[0];
    if (!program) {
      return NextResponse.json(
        { success: false, error: "errors.notFound" },
        { status: 404 },
      );
    }

    const nextManager = managerCid ? String(managerCid) : null;
    const previousManager = program.assigned_pm_id
      ? String(program.assigned_pm_id)
      : null;

    if (nextManager === previousManager) {
      // Nothing to record and nothing to reconcile — report the honest state
      // rather than rewriting the row.
      return NextResponse.json({
        success: true,
        unchanged: true,
        program: { id: String(program.id), name: program.name || null },
        manager: nextManager ? { cid: nextManager } : null,
      });
    }

    // The person must exist before we point a program at them: a dangling cid
    // would create an attachment that resolves to nobody.
    if (nextManager) {
      const contact = await getContactNameAndRole(nextManager);
      if (!contact.rows?.length) {
        return NextResponse.json(
          { success: false, error: "errors.notFound" },
          { status: 404 },
        );
      }
    }

    await setProgramManager(id, nextManager);

    // Reconcile the relationship change for BOTH sides. Reconcile failures must
    // not lose the recorded relationship: the assignment is the source of truth,
    // and the scheduled sweep (or the next connect) re-derives from it.
    const reconciled = [];
    const reconcile = async (cid) => {
      if (!cid) return;
      try {
        const result = await syncContextGrantsForUser(cid, {
          context: "program",
          roleKey: "program_manager",
        });
        reconciled.push({
          cid,
          applied: result.applied || [],
          revoked: result.revoked || [],
        });
      } catch (e) {
        console.warn(
          `[program manager] reconcile failed for ${cid}:`,
          e.message,
        );
      }
    };
    await reconcile(nextManager);
    await reconcile(previousManager);

    const session = await getSession();
    return NextResponse.json({
      success: true,
      program: { id: String(program.id), name: program.name || null },
      manager: nextManager ? { cid: nextManager } : null,
      previous: previousManager ? { cid: previousManager } : null,
      reconciled,
      actor: session?.cid || null,
    });
  } catch (err) {
    console.error("[program manager] error:", err);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
