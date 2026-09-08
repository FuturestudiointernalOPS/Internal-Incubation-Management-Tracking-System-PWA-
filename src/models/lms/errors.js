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
 * Never leaks raw database errors — the message is always an i18n key.
 */
export function lmsErrorResponse(e) {
  const status = e && e.status ? e.status : 500;
  const body = {
    success: false,
    error: e && e.message ? e.message : "errors.somethingWrong",
  };
  if (e && e.details) body.details = e.details;
  return NextResponse.json(body, { status });
}
