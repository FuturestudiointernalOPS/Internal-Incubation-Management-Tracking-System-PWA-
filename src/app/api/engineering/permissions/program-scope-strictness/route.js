import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { getSession, logPermissionAudit } from "@/lib/auth";
import {
  PROGRAM_SCOPE_WAVES,
  getProgramScopeWaves,
  setProgramScopeWave,
} from "@/models/authorization/programScopeStrictness";
import { buildProgramScopeReadiness } from "@/models/authorization/programScopeReadiness";

export const dynamic = "force-dynamic";

/**
 * GET  /api/engineering/permissions/program-scope-strictness
 * PUT  /api/engineering/permissions/program-scope-strictness
 *      body: { wave, enabled }
 *      requires permissions.assign_capabilities (write)
 *               permissions.view_matrix (read)
 *
 * THE ROLLOUT SWITCH for program record scope.
 *
 * Enforcing the rule is a REMOVAL — every holder of the program capability
 * reaches every program today — so it is switched on one domain at a time, by
 * hand, after reading the readiness report. Default: every wave OFF. Nothing is
 * turned on by deploying.
 *
 * The switch is NOT an authorization decision: it only decides whether the scope
 * CHECK runs. It fails SAFE (off) when it cannot be read, because "off" is what
 * the system did before this mechanism existed, whereas "on" would silently
 * remove access on a transient error. Authorization stays fail-CLOSED.
 *
 * Turning a wave on or off is a permission-configuration change, so it is
 * recorded in the same audit trail as every other one, with the wave as the
 * subject and both sides of the change.
 */
export async function GET() {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const waves = await getProgramScopeWaves();
    return NextResponse.json({ success: true, waves, available: PROGRAM_SCOPE_WAVES });
  } catch (err) {
    console.error("[Program Scope Strictness] read error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    const capError = await requireAuthorization(
      "permissions",
      "assign_capabilities",
    );
    if (capError) return capError;

    const body = await req.json().catch(() => ({}));
    const wave = String(body?.wave || "");
    const enabled = body?.enabled === true;
    const override = body?.override === true;

    if (!PROGRAM_SCOPE_WAVES.includes(wave)) {
      return NextResponse.json(
        { success: false, error: "unknown wave" },
        { status: 400 },
      );
    }
    if (typeof body?.enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "enabled must be a boolean" },
        { status: 400 },
      );
    }

    // MEASUREMENT BEFORE ACTION, ENFORCED. Turning a wave on is a removal, and
    // the two conditions that make it safe are computed by the readiness report:
    // every running program can be matched (no unmanaged program) and nobody is
    // left with no program at all. The switch REFUSES while either is non-zero,
    // reporting the exact blockers and the worklist size — so "read the report
    // first" is a rule rather than a hope.
    //
    // It is not a lock: an administrator who understands the consequence can pass
    // override, and the override is recorded. Turning a wave OFF is never blocked.
    if (enabled && !override) {
      const readiness = await buildProgramScopeReadiness();
      const blockers = {
        unmanaged: readiness.summary.unmanaged,
        losesEverything: readiness.summary.losesEverything,
      };
      if (blockers.unmanaged > 0 || blockers.losesEverything > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "errors.insufficientPermissions",
            reason: "not-safe-to-enable",
            blockers,
            // Named so the caller can render the worklist without a second read.
            unmanaged: readiness.unmanaged,
            waves: await getProgramScopeWaves(),
          },
          { status: 409 },
        );
      }
    }

    const before = await getProgramScopeWaves();
    const result = await setProgramScopeWave(wave, enabled);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    const session = await getSession();
    await logPermissionAudit({
      actorCid: session?.cid || null,
      actorName: session?.name || null,
      targetCid: null,
      targetName: `program scope: ${wave}`,
      action: "program_scope_changed",
      module: "permissions",
      capability: "program_scope_waves",
      previousValue: String(before[wave] === true),
      newValue: String(enabled),
      details: `Program record scope for the "${wave}" domain${override ? " (safety override)" : ""}`,
    });

    return NextResponse.json({ success: true, wave, enabled, waves: result.waves });
  } catch (err) {
    console.error("[Program Scope Strictness] write error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
