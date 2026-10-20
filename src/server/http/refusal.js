/**
 * ONE REFUSAL SHAPE.
 *
 * Every authentication and authorization refusal uses this builder. The body is
 * always `{ success: false, error: <i18n key> }`; a scoped refusal may add the
 * `missing` object that names the capability or perimeter, and the diagnostic
 * `X-Authz-Decision` header. No route or service builds its own refusal JSON.
 */

import { NextResponse } from "next/server";

/**
 * @param {{status:number, errorKey:string, missing?:object|null,
 *          decision?:string|null}} refusal
 * @returns {NextResponse}
 */
export function refusalResponse({ status, errorKey, missing = null, decision = null }) {
  const body = { success: false, error: errorKey };
  if (missing) body.missing = missing;
  const response = NextResponse.json(body, { status });
  if (decision) response.headers.set("X-Authz-Decision", decision);
  return response;
}

/**
 * D-6 (option 1 — honest refusals) — the three venture access outcomes, each
 * with its own status and reason:
 *
 *   unauthenticated → 401, nobody is signed in;
 *   not-found       → 404, the venture genuinely does not exist;
 *   out-of-scope    → 403, the venture exists but is not theirs.
 *
 * The route hands in the reason its access check returned and never builds the
 * body itself.
 */
export function ventureAccessRefusal(reason) {
  switch (reason) {
    case "unauthenticated":
      return refusalResponse({
        status: 401,
        errorKey: "errors.authRequired",
        decision: "unauthenticated",
      });
    case "not-found":
      return refusalResponse({
        status: 404,
        errorKey: "errors.ventureNotFound",
        decision: "not-found",
      });
    default:
      return refusalResponse({
        status: 403,
        errorKey: "errors.insufficientPermissions",
        missing: { scope: "venture_own" },
        decision: "out-of-scope",
      });
  }
}
