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


