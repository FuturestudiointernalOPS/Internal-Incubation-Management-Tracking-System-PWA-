/**
 * Minimal stub so src/lib/auth.js can be imported from plain Node scripts.
 * NextResponse is only referenced inside requireAuthorization(), which the
 * dry-run never calls.
 */
export const NextResponse = {
  json: (body, init = {}) => ({ body, status: init.status ?? 200 }),
};
