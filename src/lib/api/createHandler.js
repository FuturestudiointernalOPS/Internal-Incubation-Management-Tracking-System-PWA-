import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * createHandler — eliminates the try/catch/initDb/requireAuth boilerplate
 * repeated in ~120 API routes.
 *
 * Usage:
 *   export const GET = createHandler(async (req) => {
 *     ...body...
 *     return NextResponse.json({ success: true, ... });
 *   });
 *
 *   export const POST = createHandler({ roles: ['super_admin'] }, async (req) => {
 *     ...body...
 *     return NextResponse.json({ success: true, ... });
 *   });
 *
 *   // Public route (no auth):
 *   export const GET = createHandler({ public: true }, async (req) => { ... });
 *
 * Behavior:
 *   - Handles initDb + requireAuth before the handler runs.
 *   - Handler's return value is passed through directly (NextResponse or plain object).
 *   - Uncaught errors → 500 { success: false, error: message }.
 *   - Auth errors (401/403) are returned directly from requireAuth.
 */

export function createHandler(handlerOrOptions, maybeHandler) {
  // Allow: createHandler(fn) or createHandler(options, fn)
  let options = {};
  let handler;
  if (typeof handlerOrOptions === "function") {
    handler = handlerOrOptions;
  } else {
    options = handlerOrOptions;
    handler = maybeHandler;
  }

  const { roles, public: isPublic } = options;

  return async function (req, ...args) {
    try {
      if (!isPublic) {
        await initDb();
        if (roles !== undefined) {
          const authError = await requireAuth(roles);
          if (authError) return authError;
        } else {
          const authError = await requireAuth();
          if (authError) return authError;
        }
      } else {
        await initDb();
      }
      return await handler(req, ...args);
    } catch (e) {
      console.error("API Error:", e.message);
      return NextResponse.json(
        { success: false, error: e.message },
        { status: 500 },
      );
    }
  };
}
