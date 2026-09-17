import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthorizationContext, requireAuthorization } from "@/lib/authorization";
import { isWithinScope } from "@/lib/authorization/scope";
import { isWaveStrict } from "@/models/authorization/programScopeStrictness";

/**
 * PROGRAM SCOPED ACCESS — the record-scope layer for program WRITES.
 *
 * One question: "may this person act on THIS program?" The answer already
 * decided by the route (capability, or the role list the route was built with)
 * is NOT repeated here unless a capability is passed — this guard adds the
 * WHERE, not the WHAT.
 *
 *     wave OFF          → allow, unchanged (the rollout switch, default)
 *     Super Admin       → allow (resolver semantics: unscoped authority)
 *     capability (opt.) → the resolver decides
 *     program_staffed   → the program must be one they are STAFFED on
 *     → ALLOW
 *
 * `program_staffed` and not `program_assigned` on purpose: the latter includes a
 * learner's enrollment, which is right for reading a program and wrong for
 * changing it. Being enrolled never authorises editing.
 *
 * WHY A SWITCH AT ALL: enforcing this is a REMOVAL — every holder of the program
 * capability reaches every program today. The switch makes the change a decision
 * with a date, reversible in one click, and per domain so a mis-measured wave
 * can be turned back off alone. It defaults OFF, and it fails SAFE on a read
 * error (see programScopeStrictness.js) because "off" is what the system did
 * before the mechanism existed.
 *
 * Denials are explicit and diagnosable, mirroring the venture gate:
 *
 *   403  X-Authz-Decision: out-of-scope | capability-missing | unresolvable
 *        { success: false, error: "errors.insufficientPermissions",
 *          missing: { scope: "program_staffed", capability? } }
 *
 * A MISSING program id is a DENIAL when the wave is on, never a pass: an action
 * that cannot be attributed to a program cannot be scope-checked, and guessing
 * would be the one outcome worse than refusing.
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
    // The rollout switch, first: when the wave is off this guard is a no-op and
    // every caller keeps the behaviour it had before the mechanism existed.
    if (!(await isWaveStrict(wave))) return null;

    const session = await getSession();
    if (!session) {
      return denied(
        { success: false, error: "errors.authRequired" },
        401,
        "unauthenticated",
      );
    }

    // Super Admin — resolver semantics (unscoped authority).
    const ctx = await getAuthorizationContext(session);
    if (ctx?.isSuperAdmin) return null;

    // Optional capability check, for callers whose route authorises by role
    // list and wants the capability decision centralised too.
    if (module && capability) {
      const capError = await requireAuthorization(module, capability, minLevel);
      if (capError) {
        return denied(
          {
            success: false,
            error: "errors.insufficientPermissions",
            missing: { capability: `${module}.${capability}`, scope: "program_staffed" },
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
          missing: { scope: "program_staffed", reason: "program-unresolvable" },
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
          missing: { scope: "program_staffed" },
        },
        403,
        "out-of-scope",
      );
    }

    return null;
  } catch (e) {
    console.error("[requireProgramScope] error:", e?.message);
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
