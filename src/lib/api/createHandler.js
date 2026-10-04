import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { setRequestContext, withRequestContext } from "@/lib/request-context";

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
 *   - Every request is given a correlation id (an incoming `x-request-id` is
 *     reused, otherwise one is generated), exposed to all downstream code via
 *     AsyncLocalStorage — so a database warning, an authorization denial and
 *     this request's own error line share one id. The id is echoed back on the
 *     `x-request-id` response header.
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

  return withRequestContext(async (req, ...args) => {
    const started = Date.now();
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
        if (authError) {
          // An expected 401/403 is not a server fault; it is logged at debug
          // so a real denial spike can still be found without flooding prod.
          logger.debug("request_rejected", {
            status: authError.status,
            userId: session?.cid ?? null,
          });
          return authError;
        }
        req.session = session;
        if (session?.cid) {
          setRequestContext({ userId: session.cid, role: session.role });
        }
      } else {
        await initDb();
      }

      const response = await handler(req, ...args);
      logger.debug("request_completed", {
        status: response?.status ?? 200,
        durationMs: Date.now() - started,
      });
      return response;
    } catch (error) {
      logger.error("request_failed", {
        status: 500,
        durationMs: Date.now() - started,
        error: {
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        },
      });
      return NextResponse.json(
        { success: false, error: "errors.somethingWrong" },
        { status: 500 },
      );
    }
  });
}
