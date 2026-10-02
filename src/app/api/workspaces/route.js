import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { resolveLanding, landingNeedsRelationships } from "@/models/platform/roles";
import { getContactStoredRole } from "@/models/workspace";
import { getApprovedInvestorProfileIdByUserId } from "@/models/investor";
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

    // ── Phase I3: BASELINE ECHO (informational), read IN THE SAME WAVE ─────
    // contacts.role is the raw stored role (baseline identity OR legacy
    // contextual value). session.role is what today's gates see (identical to
    // baseline_role unless the I2 legacy-role derivation is enabled, in which
    // case a stored "member" may be surfaced as participant/founder).
    //
    // This read is deliberately fresh and NOT part of the cache: it is what
    // labels the identity chip, and a cached list must never be able to mislabel
    // the person it belongs to. It rides with the navigation read so that a first
    // navigation is still ONE wave, and on a cached one it is the only statement.
    //
    // The investor context rides in the same wave, for the same reason: `home` is
    // not cached, and whether the person was MADE an investor can move it. It is
    // answered locally (no statement) for a global identity, whose home never
    // depends on relationships.
    const needsRelationshipReads = landingNeedsRelationships(session.role);
    const [navigation, [storedRoleSettled, investorSettled]] = await Promise.all([
      cachedNavigation
        ? cachedNavigation
        : buildWorkspaceNavigation(session, contextsOnly).then((builtNavigation) => {
            writeWorkspaceContext(session.cid, scope, builtNavigation);
            return builtNavigation;
          }),
      Promise.allSettled([
        getContactStoredRole(session.cid),
        needsRelationshipReads
          ? getApprovedInvestorProfileIdByUserId(session.cid)
          : Promise.resolve({ rows: [] }),
      ]),
    ]);

    const isInvestor = rowsOf(investorSettled).length > 0;

    const { baselineRole, derivedRole } = deriveBaselineRole(
      session,
      rowsOf(storedRoleSettled)[0]?.role,
    );

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
      // person: same rule, same data (the memberships just read above), so the
      // door and the button can never point at two different places.
      home: resolveLanding({
        role: session.role,
        ventures: navigation.contexts?.venture_memberships || [],
        isInvestor,
      }),
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
