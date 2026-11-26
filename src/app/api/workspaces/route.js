import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import {
  resolveLanding,
  resolveLandingFromAccess,
  landingFromRightsEnabled,
} from "@/models/platform/roles";
import { getAuthorizationContext } from "@/models/authorization/index";
import { getContactStoredRole } from "@/models/workspace";
import {
  readWorkspaceContext,
  writeWorkspaceContext,
} from "@/lib/workspaceContextCache";
import {
  buildWorkspaceNavigation,
  deriveBaselineRole,
} from "@/services/workspace";

export const dynamic = "force-dynamic";

/**
 * WORKSPACES API — neutral post-login hub data
 *
 * Returns the authenticated user's assignments (program staff roles and
 * participant enrollments) plus the fallback home dashboard for their global
 * role. Any authenticated user may call this; having no assignment
 * is a valid state.
 *
 * `?scope=contexts` answers only the context list the page shell renders. The
 * hub page calls it without a scope and gets everything.
 *
 * The navigation list and contexts are BUILT in the workspace service
 * (`src/services/workspace/navigation.js`); the identity labels come from the
 * matching decision there. This handler only authenticates, resolves the cache
 * scope, runs the fresh identity reads beside the navigation, and shapes the
 * response.
 *
 * WHAT IS CACHED: the navigation list (the `workspaces` and `contexts` payload),
 * per person and per scope, under the invalidation rule the authorization cache
 * follows (src/lib/workspaceContextCache.js). The identity chip is deliberately
 * NOT cached — see the note beside it.
 */

/** Rows of a settled read, or an empty list when it failed. */
const rowsOf = (settled) =>
  settled.status === "fulfilled" ? settled.value.rows || [] : [];

export async function GET(request) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();

    // ── Scope ──────────────────────────────────────────────────────────────
    // The context switcher in the page shell asks for `?scope=contexts`; the hub
    // page asks for everything. Two of the reads serve the hub page alone (the
    // flat assignment list and the generalized program assignments), so the two
    // scopes are cached separately.
    const contextsOnly =
      new URL(request.url).searchParams.get("scope") === "contexts";
    const scope = contextsOnly ? "contexts" : "full";

    // ── The navigation list, cached per person ─────────────────────────────
    // It is a function of the person's access and nothing else, and it changes
    // only when that access changes - which is rare, while the shell asks for it
    // on every page. It is dropped by the same writes that drop the
    // authorization context (src/lib/workspaceContextCache.js).
    const cachedNavigation = readWorkspaceContext(session.cid, scope);

    // ── Phase I3: BASELINE ECHO (informational) ─────────────────────────────
    // contacts.role is the raw stored role (baseline identity OR legacy
    // contextual value). session.role is what today's gates see (identical to
    // baseline_role unless the I2 legacy-role derivation is enabled, in which
    // case a stored "member" may be surfaced as participant/founder).
    //
    // This read is deliberately fresh and NOT part of the cache: it is what
    // labels the identity chip, and a cached list must never be able to mislabel
    // the person it belongs to. It rides with the navigation read so that a
    // first navigation is still ONE wave, and on a cached one it is the only
    // statement.
    //
    // The home button no longer reads any relationship: the member space answers
    // ONE destination for everyone (the unified dashboard), so `home` is decided
    // from the space alone. The hub's context list keeps its own reads — they
    // describe the person's workspaces, not their destination.
    const [navigation, [storedRoleSettled]] = await Promise.all([
      cachedNavigation
        ? cachedNavigation
        : buildWorkspaceNavigation(session, contextsOnly).then((builtNavigation) => {
            writeWorkspaceContext(session.cid, scope, builtNavigation);
            return builtNavigation;
          }),
      Promise.allSettled([getContactStoredRole(session.cid)]),
    ]);

    const { baselineRole, derivedRole } = deriveBaselineRole(
      session,
      rowsOf(storedRoleSettled)[0]?.role,
    );

    // Étape 4 — the home button asks the same access question the login asked.
    let accessContext = null;
    if (landingFromRightsEnabled()) {
      try {
        accessContext = await getAuthorizationContext(session);
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      user: {
        cid: session.cid,
        name: session.name,
        email: session.email,
        role: session.role,
        baseline_role: baselineRole,
        derived_role: derivedRole,
      },
      // The home button must agree with where the login actually sent this
      // person: same rule, same data.
      home: landingFromRightsEnabled()
        ? resolveLandingFromAccess({
            role: session.role,
            profiles: accessContext?.profiles || [],
            effective: accessContext?.effective || null,
          })
        : resolveLanding({ role: session.role }),
      workspaces: navigation.workspaces,
      contexts: navigation.contexts,
    });
  } catch (error) {
    console.error("[workspaces] error:", error.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
