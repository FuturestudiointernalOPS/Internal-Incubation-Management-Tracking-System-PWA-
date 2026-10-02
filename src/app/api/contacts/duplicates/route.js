import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/models/authorization/index";
import {
  listPendingDuplicateFlags,
  dismissPendingDuplicateFlag,
} from "@/services/contacts/duplicateFlags";

export const dynamic = "force-dynamic";

/**
 * /api/contacts/duplicates — the candidate-duplicate review queue.
 *
 * GET    /api/contacts/duplicates?limit=   list pending flags (capped)
 * DELETE /api/contacts/duplicates?id=       dismiss a pending flag
 *
 * The page-size clamp, the flag shaping and the "only dismiss a pending flag"
 * rule live in `@/services/contacts/duplicateFlags`; this route authenticates,
 * gates on the capability and shapes the HTTP answer.
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const flags = await listPendingDuplicateFlags(searchParams.get("limit"));

    return NextResponse.json({ success: true, flags });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || "errors.somethingWrong" },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const capError = await requireAuthorization("contacts", "edit");
    if (capError) return capError;

    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id)
      return NextResponse.json(
        { success: false, error: "errors.required" },
        { status: 400 },
      );

    // Only dismiss flags that are still pending; never overwrite a merged flag.
    const dismissed = await dismissPendingDuplicateFlag(id, session?.cid || null);
    if (!dismissed) {
      return NextResponse.json(
        { success: false, error: "errors.notFound" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
