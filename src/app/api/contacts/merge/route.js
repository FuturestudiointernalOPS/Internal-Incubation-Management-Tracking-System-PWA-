import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { mergeContacts } from "@/services/contacts";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const capError = await requireAuthorization("contacts", "delete");
    if (capError) return capError;

    const session = await getSession();
    const { survivor_cid, duplicate_cid } = await req.json();

    const result = await mergeContacts({
      survivorCid: survivor_cid,
      duplicateCid: duplicate_cid,
      actorCid: session.cid,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
