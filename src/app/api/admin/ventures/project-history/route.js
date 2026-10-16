import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { clearProjectHistory, previewProjectHistory } from "@/services/ventures/projectHistory";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/admin/ventures/project-history
 *
 * The Venture project-management history, across every Venture:
 *
 *   GET   what a purge would remove (the scope, what stays, the live counts)
 *   POST  clear it — permanently
 *
 * AUTHORIZATION — the canonical engine, not a role string. Both verbs require
 * `ventures.delete`, which the capability catalog rates high-risk ("Delete
 * ventures") and which today is granted to `super_admin_default` alone (the
 * Super Admin also passes by the resolver's own bypass). A staff or venture
 * manager profile holds `ventures.view`/`ventures.edit` and is refused here by
 * the engine, before any statement runs — the button being hidden is a courtesy,
 * never the control.
 *
 * POST also requires an explicit `{ confirm: true }`. An accidental or replayed
 * request cannot clear the history; the confirmation is the one the administrator
 * saw in the dialog, sent back deliberately.
 *
 * Neither verb touches a Venture's profile, people, permissions or financial
 * records — see `@/services/ventures/projectHistory` for the scope as data.
 */
export const GET = async () => {
  await initDb();
  const capError = await requireAuthorization("ventures", "delete");
  if (capError) return capError;

  try {
    const preview = await previewProjectHistory();
    return NextResponse.json({ success: true, ...preview });
  } catch (error) {
    console.error("[project-history] preview failed:", error?.message || error);
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
};

export const POST = async (req) => {
  await initDb();
  const capError = await requireAuthorization("ventures", "delete");
  if (capError) return capError;

  let body = {};
  try {
    body = await req.json();
  } catch (_) {
    body = {};
  }
  if (body?.confirm !== true) {
    return NextResponse.json(
      { success: false, error: "errors.confirmRequired", code: "CONFIRMATION_REQUIRED" },
      { status: 400 },
    );
  }

  // Who confirmed it — the session, read here so the audit names a real person.
  let session = null;
  try {
    session = await getSession();
  } catch (_) {
    session = null;
  }

  const result = await clearProjectHistory({
    actor: { cid: session?.cid, name: session?.name, role: session?.role },
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    removed: result.removed,
    tables: result.tables,
  });
};
