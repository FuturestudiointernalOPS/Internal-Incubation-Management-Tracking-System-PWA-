import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthorizationContext, requireAuthorization } from "@/lib/authorization";
import { isWithinScope } from "@/lib/authorization/scope";

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
 *     program_staffed   → the program must be one they are STAFFED on
 *     → ALLOW
 *
 * `program_staffed` and not `program_assigned` on purpose: the latter includes a
 * learner's enrollment, which is right for reading a program and wrong for
 * changing it. Being enrolled never authorises editing.
 *
 * ENFORCED UNCONDITIONALLY. There is deliberately no rollout switch: a rule that
 * only applies when somebody remembers to enable it does not protect anything,
 * and the switch this replaced made "read the report first" the only thing
 * standing between measurement and action — which is not a control at all.
 *
 * WHAT THAT MEANS OPERATIONALLY, stated plainly because it is a real consequence:
 * a program whose manager nobody recorded can never be matched by this rule, so
 * only Super Admin can write to it until a manager is assigned. That is what the
 * readiness report's unmanaged worklist is for, and why the repair action is
 * reachable with the permission-console authority as well as from inside the
 * program (see api/pm/programs/[id]/manager).
 *
 * `wave` does not gate anything — it names the domain being protected so a
 * denial says WHICH rule refused, and so the census can hold each write surface to
 * a domain.
 *
 * Denials are explicit and diagnosable, mirroring the venture gate:
 *
 *   403  X-Authz-Decision: out-of-scope | capability-missing | unresolvable
 *        { success: false, error: "errors.insufficientPermissions",
 *          missing: { scope: "program_staffed", wave, capability? } }
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
  minLevel = 1,
}) {
  const denied = (body, status, decision) => {
    const res = NextResponse.json(body, { status });
    res.headers.set("X-Authz-Decision", decision);
    return res;
  };

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
    if (module && capability) {
      const capError = await requireAuthorization(module, capability, minLevel);
      if (capError) {
        return denied(
          {
            success: false,
            error: "errors.insufficientPermissions",
            missing: {
              capability: `${module}.${capability}`,
              scope: "program_staffed",
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
          missing: { scope: "program_staffed", wave, reason: "program-unresolvable" },
        },
        403,
        "unresolvable",
      );
    }

    const within = await isWithinScope("program_staffed", session.cid, programId, {
      email: session.email,
    });
    if (!within) {
      return denied(
        {
          success: false,
          error: "errors.insufficientPermissions",
          missing: { scope: "program_staffed", wave },
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
