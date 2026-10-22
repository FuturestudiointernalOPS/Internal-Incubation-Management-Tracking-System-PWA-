import { NextResponse } from "next/server";

/**
 * LMS domain error — carries an i18n error key and an HTTP status.
 * Route handlers map it to `{ success: false, error: key }` responses.
 */
export class LmsError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = "LmsError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Standard error response for LMS route handlers.
 * Never leaks raw database errors: only an LmsError's message — always an i18n
 * key — reaches the client. Anything else (a failed query, a bug) is logged
 * and answered with the generic key and a 500.
 */
export function lmsErrorResponse(error) {
  if (!(error instanceof LmsError)) {
    console.error("[LMS] unexpected error:", error);
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
  const body = { success: false, error: error.message || "errors.somethingWrong" };
  if (error.details) body.details = error.details;
  return NextResponse.json(body, { status: error.status || 500 });
}
