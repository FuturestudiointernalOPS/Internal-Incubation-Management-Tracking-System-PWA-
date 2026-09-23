import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
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
 *   - Uncaught errors → 500 { success: false, error: "errors.somethingWrong" } (stable i18n key; the real message is logged server-side only).
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
        // Resolve the session ONCE and hand it to the guard, then attach it so
        // handlers can attribute writes to the real actor (`req.session?.cid`).
        // Without it every `req.session` read was undefined — losing audit
        // attribution and breaking routes that dereference it (e.g.
        // security/events).
        const session = await getSession();
        const authError = await requireAuth(roles, session);
        if (authError) return authError;
        req.session = session;
      } else {
        await initDb();
      }
      return await handler(req, ...args);
    } catch (error) {
      console.error("API Error:", error.message);
      return NextResponse.json(
        { success: false, error: "errors.somethingWrong" },
        { status: 500 },
      );
    }
  };
}
