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
 * A RETIRED ROUTE — the feature is gone, the path is still registered.
 *
 * It answers with the one refusal shape and records ONE structured line per
 * hit. The log is deliberate: deleting a route needs proof that nobody calls it
 * any more, and the only proof that exists outside the repository is traffic.
 * When the line has been silent for a full period, the route can be deleted;
 * until then it refuses, which is the safe state.
 *
 * @param {string} feature the retired surface, for the log line
 * @returns {NextResponse}
 */
export function retiredRouteResponse(feature) {
  console.warn(`[retired-route] ${feature} was called`);
  return refusalResponse({
    status: 403,
    errorKey: "errors.featureRetired",
    decision: "retired",
  });
}


