import { NextResponse } from "next/server";
import { refusalResponse } from "./refusal";

export function organizationProgramResponse(result) {
  if (result.success) return NextResponse.json(result);
  const status = result.reason === "no-session" ? 401
    : ["invalid-query", "invalid-program"].includes(result.reason) ? 400
      : result.reason === "context-changed" ? 409 : result.reason === "not-found" ? 404 : 403;
  return refusalResponse({ status, errorKey: result.errorKey, decision: result.reason });
}

// Includes authentication failures and exception responses from createHandler.
export function privateOrganizationHandler(handler) {
  return async (...args) => {
    const response = await handler(...args);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.append("Vary", "Cookie");
    return response;
  };
}
