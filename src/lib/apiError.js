import { NextResponse } from "next/server";

/**
 * A SAFE server-error response.
 *
 * A caught exception frequently carries driver, SQL or stack detail. Returning
 * `error.message` to the client hands that internal structure to whoever can
 * trigger the failure. This logs the real error server-side (never to the
 * browser) and answers with a stable, non-internal message instead.
 *
 * @param {unknown} error  the caught error — logged, never serialized
 * @param {{ status?: number, message?: string, log?: string }} [options]
 */
export function serverError(
  error,
  { status = 500, message = "errors.somethingWrong", log = "[api]" } = {},
) {
  console.error(`${log}:`, error?.stack || error?.message || error);
  return NextResponse.json({ success: false, error: message }, { status });
}

export default { serverError };
