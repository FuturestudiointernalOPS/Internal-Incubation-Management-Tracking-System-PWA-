/**
 * server/authz — the HTTP boundary for the authorization decisions.
 *
 * The authorization SERVICE (`@/services/authorization/*`) answers with a
 * decision ({ allowed, status, errorKey }); routes need the opposite shape —
 * "the response to return, or null to continue":
 *
 *     const authError = await requireAuthorization("permissions", "view_matrix");
 *     if (authError) return authError;
 *
 * This module is the only place that turns a decision into a `NextResponse`. It
 * is deliberately dumb: no policy, no queries — just the mapping. Keeping it
 * here (next to the other 401/403/404/409 guards) is what lets every service
 * stay free of `next/server`.
 */

import { NextResponse } from "next/server";
import { evaluateAuthorization } from "@/services/authorization/context";
import { evaluateScopedAccess } from "@/services/authorization/scopedAccess";

/** Map a decision to the refusal response, or null when it is allowed. */
function toResponse({ allowed, status, errorKey }) {
  if (allowed) return null;
  return NextResponse.json({ success: false, error: errorKey }, { status });
}

/**
 * Capability gate. Drop-in for the previous helper: returns null when allowed,
 * or the 401/403/500 response to return as-is.
 */
export async function requireAuthorization(module, capability, minLevel = 1) {
  return toResponse(await evaluateAuthorization(module, capability, minLevel));
}

/**
 * Scoped gate: capability AND assignment to a specific resource. Returns null
 * when allowed, or the 401/403/500 response to return as-is.
 */
export async function requireScopedAccess(params) {
  return toResponse(await evaluateScopedAccess(params));
}
