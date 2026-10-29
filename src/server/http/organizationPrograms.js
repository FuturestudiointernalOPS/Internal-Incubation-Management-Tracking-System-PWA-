import { NextResponse } from "next/server";
import { refusalResponse } from "./refusal";
import { readSessionToken } from "@/server/auth/cookies";
import { getOrganizationSession } from "@/services/organizations/session";
import { withRequestContext, setRequestContext } from "@/lib/request-context";
import { logger } from "@/lib/logger";

// Dedicated boundary: createHandler/getSession run lazy DDL and token backfills.
// Those internal conveniences must never run while browsing a client portal.
export function organizationHandler(handler) {
  return withRequestContext(async (req, ...args) => {
    try {
      const session = await getOrganizationSession(await readSessionToken());
      if (!session) return refusalResponse({ status: 401, errorKey: "errors.authRequired" });
      req.session = session;
      setRequestContext({ userId: session.cid, role: session.role });
      return await handler(req, ...args);
    } catch (error) {
      // SQL and token values do not belong in the boundary log or response.
      logger.error("organization_request_failed", { error: { name: error?.name } });
      return refusalResponse({ status: 500, errorKey: "errors.somethingWrong" });
    }
  });
}

export function organizationProgramResponse(result) {
  if (result.success) return NextResponse.json(result);
  const status = result.reason === "no-session" ? 401
    : ["invalid-query", "invalid-program"].includes(result.reason) ? 400
      : ["context-changed", "revision-conflict", "record-closed", "record-open"].includes(result.reason) ? 409 : result.reason === "not-found" ? 404 : 403;
  return refusalResponse({ status, errorKey: result.errorKey, decision: result.reason });
}

// Includes authentication failures and exception responses from organizationHandler.
export function privateOrganizationHandler(handler) {
  return async (...args) => {
    const response = await handler(...args);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.append("Vary", "Cookie");
    return response;
  };
}
