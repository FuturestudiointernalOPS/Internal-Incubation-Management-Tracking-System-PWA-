/**
 * The address migration — every legacy route and where it now lives.
 *
 * These entries are the ONLY record of the addresses the spaces moved. They are
 * kept in a plain module rather than inline in the Next config so they can be
 * tested: order matters (a specific alias must be checked before its parent),
 * destinations must point into a real space, and a legacy destination would be
 * a redirect loop waiting to happen.
 *
 * ── Flipping to permanent ───────────────────────────────────────────────────
 * While the migration is being validated in production every entry answers a
 * TEMPORARY redirect (307): browsers do not cache it, so a mistake is
 * reversible. Once `docs/PRODUCTION_TEST.md` passes on the new addresses, set
 * `SPACE_REDIRECTS_PERMANENT=1` in the production build environment and
 * redeploy. No code change is needed — this module reads the flag.
 *
 * A permanent redirect (308) is cached by browsers. Turning it off later does
 * NOT un-cache it for people who already followed it; that is exactly why the
 * default is temporary.
 */

/** Whether the migration redirects answer permanently (308). */
export const SPACE_REDIRECTS_PERMANENT =
  process.env.SPACE_REDIRECTS_PERMANENT === "1" ||
  String(process.env.SPACE_REDIRECTS_PERMANENT).toLowerCase() === "true";

/**
 * Ordered: an alias with more path segments comes before its parent, so
 * `/founder/ventures` is resolved before the generic `/founder` rule.
 */
export const SPACE_REDIRECTS = [
  // ── Member space ────────────────────────────────────────────────────────
  // The founder's venture screens always lived with the participant ventures.
  { source: "/founder/ventures/:path*", destination: "/member/participant/ventures/:path*" },
  { source: "/founder/ventures", destination: "/member/participant/ventures" },
  { source: "/participant/:path*", destination: "/member/participant/:path*" },
  { source: "/participant", destination: "/member/participant" },
  { source: "/founder/:path*", destination: "/member/founder/:path*" },
  { source: "/founder", destination: "/member/founder" },
  { source: "/investor/:path*", destination: "/member/investor/:path*" },
  { source: "/investor", destination: "/member/investor" },
  { source: "/facilitator/:path*", destination: "/member/facilitator/:path*" },
  { source: "/facilitator", destination: "/member/facilitator" },
  { source: "/team/:path*", destination: "/member/team/:path*" },
  { source: "/team", destination: "/member/team" },
  { source: "/workspaces", destination: "/member" },

  // ── Staff space ─────────────────────────────────────────────────────────
  { source: "/pm/:path*", destination: "/staff/program-manager/:path*" },
  { source: "/pm", destination: "/staff/program-manager" },
  { source: "/finance/:path*", destination: "/staff/finance/:path*" },
  { source: "/finance", destination: "/staff/finance" },
  { source: "/crm/:path*", destination: "/staff/crm/:path*" },
  { source: "/crm", destination: "/staff/crm" },
  { source: "/create/:path*", destination: "/staff/create/:path*" },
  { source: "/create", destination: "/staff/create" },
];

/** The redirect list expected by Next, with the permanence flag applied. */
export function spaceRedirects({ permanent = SPACE_REDIRECTS_PERMANENT } = {}) {
  return SPACE_REDIRECTS.map((entry) => ({ ...entry, permanent }));
}
