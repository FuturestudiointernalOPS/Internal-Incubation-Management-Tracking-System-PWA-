import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/models/authorization/index";
import { mergeContacts } from "@/services/contacts/merge";

export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/merge — fold a duplicate contact into a survivor.
 *
 * The merge sequence (reassign programs / ventures / timeline, reconcile context
 * grants, write the merge event, soft-delete the duplicate, resolve the flags)
 * lives in `@/services/contacts/merge`; this route authenticates, gates on the
 * capability and shapes the HTTP answer.
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const capError = await requireAuthorization("contacts", "delete");
    if (capError) return capError;

    const session = await getSession();
    const { survivor_cid, duplicate_cid } = await req.json();
    if (!survivor_cid || !duplicate_cid) {
      return NextResponse.json({ success: false, error: "survivor_cid and duplicate_cid required" }, { status: 400 });
    }

    const { summary, counts } = await mergeContacts({
      survivorCid: survivor_cid,
      duplicateCid: duplicate_cid,
      actorCid: session.cid,
    });

    return NextResponse.json({ success: true, summary, counts });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
