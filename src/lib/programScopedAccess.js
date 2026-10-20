import { refusalResponse } from "@/server/http/refusal";
import { getSession } from "@/server/auth/session";
import { getAuthorizationContext, requireAuthorization } from "@/models/authorization/index";
import { isWithinScope } from "@/services/authorization/scope";

/**
 * PROGRAM SCOPED ACCESS — the record-scope layer for program WRITES.
 *
 * One question: "may this person act on THIS program?" The answer already
 * decided by the route (capability, or the role list the route was built with)
 * is NOT repeated here unless a capability is passed — this guard adds the
 * WHERE, not the WHAT.
 *
 *     Super Admin       → allow (resolver semantics: unscoped authority)
 *     capability (opt.) → the resolver decides
 *     program_managed   → the program must be one they MANAGE
 *     → ALLOW
 *
 * `program_managed` and not `program_staffed`/`program_assigned` on purpose
 * (D-4): the WRITE perimeter is the `program_manager` PROFILE, not a staffing
 * row. A facilitator assigned to a program is not its manager, so they do not
 * write to it; being enrolled never authorises editing. The assigned manager
 * receives the profile automatically, and the same profile can be granted to
 * anyone else — so the perimeter follows the GRANT.
 *
 * The switch was measured first: `scripts/db-audit/program-perimeter-compare.sql`
 * compared both perimeters on the production database. It found two people in
 * the old one and one in the new one, no gain, and a single loss — a facilitator
 * who had already lost `programs.edit` in step 3.2. That divergence is
 * explained, so the transition probe was removed (Lot 8); the old
 * `program_staffed` policy itself is NOT a shadow policy — the manager repair
 * route enforces it deliberately (see `scope-catalog.js`).
 *
 * ENFORCED UNCONDITIONALLY. There is deliberately no rollout switch: a rule that
 * only applies when somebody remembers to enable it does not protect anything.
 *
 * WHAT THAT MEANS OPERATIONALLY, stated plainly because it is a real consequence:
 * a program with no active `program_manager` profile can never be matched by
 * this rule, so only Super Admin can write to it until a manager is assigned.
 * That is what the readiness report's unmanaged worklist is for, and why the
 * repair action is reachable with the permission-console authority as well as
 * from inside the program (see api/pm/programs/[id]/manager).
 *
 * `wave` does not gate anything — it names the domain being protected so a
 * denial says WHICH rule refused, and so the census can hold each write surface to
 * a domain.
 *
 * Denials are explicit and diagnosable, mirroring the venture gate:
 *
 *   403  X-Authz-Decision: out-of-scope | capability-missing | unresolvable
 *        { success: false, error: "errors.insufficientPermissions",
 *          missing: { scope: "program_managed", wave, capability? } }
 *
 * A MISSING program id is a DENIAL, never a pass: an action that cannot be
 * attributed to a program cannot be scope-checked, and guessing would be the one
 * outcome worse than refusing.
 *
 * Returns null on allow (drop-in for the other guards) or a NextResponse.
 */
export async function requireProgramScope({
  programId,
  wave,
  module = null,
  capability = null,
  capabilities = null,
  minLevel = 1,
}) {
  const denied = (body, status, decision) =>
    refusalResponse({
      status,
      errorKey: body.error,
      missing: body.missing,
      decision,
    });

  try {
    const session = await getSession();
    if (!session) {
      return denied(
        { success: false, error: "errors.authRequired" },
        401,
        "unauthenticated",
      );
    }

    // Super Admin — resolver semantics (unscoped authority).
    const authContext = await getAuthorizationContext(session);
    if (authContext?.isSuperAdmin) return null;

    // Optional capability check, for callers whose route authorises by role
    // list and wants the capability decision centralised too.
    //
    // `capabilities` is an ANY-OF list, used where the same action is exercised
    // by two camps whose rights are NOT interchangeable: grading a submission
    // is `facilitator.assignments.grade` for a facilitator and
    // `programs.edit` for a program manager. Each capability is only held by
    // its own camp, so "any of" never lets one camp borrow the other's right.
    const required = Array.isArray(capabilities)
      ? capabilities
      : module && capability
        ? [{ module, capability }]
        : [];

    if (required.length > 0) {
      let allowed = false;
      for (const requirement of required) {
        const capError = await requireAuthorization(
          requirement.module,
          requirement.capability,
          minLevel,
        );
        if (!capError) {
          allowed = true;
          break;
        }
      }

      if (!allowed) {
        return denied(
          {
            success: false,
            error: "errors.insufficientPermissions",
            missing: {
              capability: required
                .map((requirement) => `${requirement.module}.${requirement.capability}`)
                .join(" | "),
              scope: "program_managed",
              wave,
            },
          },
          403,
          "capability-missing",
        );
      }
    }

    if (programId === null || programId === undefined || String(programId).trim() === "") {
      return denied(
        {
          success: false,
          error: "errors.insufficientPermissions",
          missing: { scope: "program_managed", wave, reason: "program-unresolvable" },
        },
        403,
        "unresolvable",
      );
    }

    const within = await isWithinScope("program_managed", session.cid, programId, {
      email: session.email,
    });

    if (!within) {
      return denied(
        {
          success: false,
          error: "errors.insufficientPermissions",
          missing: { scope: "program_managed", wave },
        },
        403,
        "out-of-scope",
      );
    }

    return null;
  } catch (error) {
    console.error("[requireProgramScope] error:", error?.message);
    return denied(
      { success: false, error: "errors.authzSystemFailure" },
      500,
      "system-failure",
    );
  }
}

/**
 * The same check for an action that covers SEVERAL programs at once (bulk
 * enrollment). Every id must be in scope — one out-of-scope id denies the whole
 * request rather than applying half of it, because a partial write is harder to
 * see and to undo than a refusal.
 */
export async function requireProgramScopeForAll({ programIds, wave, module, capability, minLevel }) {
  const ids = (Array.isArray(programIds) ? programIds : [programIds])
    .map((id) => (id === null || id === undefined ? "" : String(id)))
    .filter((id) => id.trim() !== "");

  if (ids.length === 0) {
    return requireProgramScope({ programId: null, wave, module, capability, minLevel });
  }
  for (const id of ids) {
    const error = await requireProgramScope({
      programId: id,
      wave,
      module,
      capability,
      minLevel,
    });
    if (error) return error;
  }
  return null;
}
